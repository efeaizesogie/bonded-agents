//! Bonded Agents — AI agents that put skin in the game.
//!
//! An AI agent locks SOL as a bond before it can take paid work.
//! Clients escrow payment for a job. If the agent's work is disputed and an
//! (AI) arbiter rules the agent at fault, part of the bond is slashed and paid
//! to the client together with a full refund. Every agent builds a public,
//! unfakeable track record: jobs completed, jobs slashed, SOL slashed.

use anchor_lang::prelude::*;
use anchor_lang::system_program;

// Replace with your program id after anchor keys sync (or Solana Playground build).
declare_id!("jVwyysSicpg9RtaiXtyuuWTNC8GGE41K1qcGPjAH29F");

pub const MAX_NAME: usize = 32;
pub const MAX_MODEL: usize = 32;
pub const MAX_SPEC: usize = 280;
/// Results are stored encrypted ("enc1:" + base64 envelope), so they need more room.
pub const MAX_RESULT: usize = 1200;
pub const MAX_REASON: usize = 200;
pub const MAX_VERDICT: usize = 280;
pub const BPS_DENOM: u64 = 10_000;
/// Hard caps so an admin can never set a predatory fee.
pub const MAX_FEE_BPS: u16 = 2_000; // 20% of a payout
pub const MAX_SLASH_FEE_BPS: u16 = 5_000; // 50% of a slash

#[program]
pub mod bonded_agents {
    use super::*;

    /// One-time setup: who the arbiter (AI judge signer) is, how long clients
    /// have to review submitted work, and how much of the staked bond is slashed.
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        arbiter: Pubkey,
        review_window_secs: i64,
        slash_bps: u16,
    ) -> Result<()> {
        require!(review_window_secs > 0, BondError::InvalidParam);
        require!(slash_bps as u64 <= BPS_DENOM, BondError::InvalidParam);
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.arbiter = arbiter;
        config.review_window_secs = review_window_secs;
        config.slash_bps = slash_bps;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    /// Admin can rotate the arbiter key or tune parameters.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        arbiter: Pubkey,
        review_window_secs: i64,
        slash_bps: u16,
    ) -> Result<()> {
        require!(review_window_secs > 0, BondError::InvalidParam);
        require!(slash_bps as u64 <= BPS_DENOM, BondError::InvalidParam);
        let config = &mut ctx.accounts.config;
        config.arbiter = arbiter;
        config.review_window_secs = review_window_secs;
        config.slash_bps = slash_bps;
        Ok(())
    }

    /// Platform economics: where fees go and how big they are. Admin only.
    /// arbiter_enc_key is the judge's public encryption key, so agents can
    /// encrypt results that only the client and the judge can read.
    pub fn initialize_settings(
        ctx: Context<InitializeSettings>,
        treasury: Pubkey,
        fee_bps: u16,
        slash_fee_bps: u16,
        arbiter_enc_key: [u8; 32],
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, BondError::InvalidParam);
        require!(slash_fee_bps <= MAX_SLASH_FEE_BPS, BondError::InvalidParam);
        let settings = &mut ctx.accounts.settings;
        settings.admin = ctx.accounts.admin.key();
        settings.treasury = treasury;
        settings.fee_bps = fee_bps;
        settings.slash_fee_bps = slash_fee_bps;
        settings.arbiter_enc_key = arbiter_enc_key;
        settings.total_fees = 0;
        settings.bump = ctx.bumps.settings;
        Ok(())
    }

    pub fn update_settings(
        ctx: Context<UpdateSettings>,
        treasury: Pubkey,
        fee_bps: u16,
        slash_fee_bps: u16,
        arbiter_enc_key: [u8; 32],
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, BondError::InvalidParam);
        require!(slash_fee_bps <= MAX_SLASH_FEE_BPS, BondError::InvalidParam);
        let settings = &mut ctx.accounts.settings;
        settings.treasury = treasury;
        settings.fee_bps = fee_bps;
        settings.slash_fee_bps = slash_fee_bps;
        settings.arbiter_enc_key = arbiter_enc_key;
        Ok(())
    }

    /// Register an agent and lock its initial bond inside the agent PDA.
    /// One agent per wallet: the agent account is derived from the wallet.
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        model: String,
        bond_lamports: u64,
    ) -> Result<()> {
        require!(name.len() <= MAX_NAME, BondError::TooLong);
        require!(model.len() <= MAX_MODEL, BondError::TooLong);
        require!(bond_lamports > 0, BondError::InvalidParam);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.agent.to_account_info(),
                },
            ),
            bond_lamports,
        )?;

        let agent = &mut ctx.accounts.agent;
        agent.authority = ctx.accounts.authority.key();
        agent.name = name;
        agent.model = model;
        agent.bond = bond_lamports;
        agent.locked = 0;
        agent.jobs_completed = 0;
        agent.jobs_slashed = 0;
        agent.total_earned = 0;
        agent.total_slashed = 0;
        agent.created_at = Clock::get()?.unix_timestamp;
        agent.bump = ctx.bumps.agent;

        emit!(AgentRegistered {
            agent: agent.key(),
            authority: agent.authority,
            bond: bond_lamports,
        });
        Ok(())
    }

    /// Top up the bond (raises the stake ceiling for bigger jobs).
    pub fn add_bond(ctx: Context<AddBond>, amount: u64) -> Result<()> {
        require!(amount > 0, BondError::InvalidParam);
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.authority.to_account_info(),
                    to: ctx.accounts.agent.to_account_info(),
                },
            ),
            amount,
        )?;
        let agent = &mut ctx.accounts.agent;
        agent.bond = agent.bond.checked_add(amount).ok_or(BondError::MathOverflow)?;
        Ok(())
    }

    /// Withdraw bond that is not currently staked on an open job.
    pub fn withdraw_bond(ctx: Context<WithdrawBond>, amount: u64) -> Result<()> {
        let agent = &mut ctx.accounts.agent;
        let free = agent.bond.checked_sub(agent.locked).ok_or(BondError::MathOverflow)?;
        require!(amount > 0 && amount <= free, BondError::InsufficientFreeBond);
        agent.bond -= amount;
        move_lamports(
            &agent.to_account_info(),
            &ctx.accounts.authority.to_account_info(),
            amount,
        )?;
        Ok(())
    }

    /// Client posts a job and escrows the payment in the job PDA.
    /// required_stake is how much of an agent's bond gets locked while it
    /// works on this job — the agent's skin in the game.
    pub fn post_job(
        ctx: Context<PostJob>,
        job_id: u64,
        payment: u64,
        required_stake: u64,
        spec: String,
        enc_key: [u8; 32],
    ) -> Result<()> {
        require!(spec.len() <= MAX_SPEC, BondError::TooLong);
        require!(payment > 0, BondError::InvalidParam);

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.client.to_account_info(),
                    to: ctx.accounts.job.to_account_info(),
                },
            ),
            payment,
        )?;

        let job = &mut ctx.accounts.job;
        job.client = ctx.accounts.client.key();
        job.job_id = job_id;
        job.agent = Pubkey::default();
        job.payment = payment;
        job.required_stake = required_stake;
        job.status = JobStatus::Open;
        job.spec = spec;
        job.result = String::new();
        job.dispute_reason = String::new();
        job.verdict = String::new();
        job.slashed_amount = 0;
        job.created_at = Clock::get()?.unix_timestamp;
        job.submitted_at = 0;
        job.bump = ctx.bumps.job;
        job.enc_key = enc_key;
        job.fee_paid = 0;

        emit!(JobPosted {
            job: job.key(),
            client: job.client,
            payment,
            required_stake,
        });
        Ok(())
    }

    /// Client cancels a job nobody accepted yet; escrow + rent are returned.
    pub fn cancel_job(ctx: Context<CancelJob>) -> Result<()> {
        require!(ctx.accounts.job.status == JobStatus::Open, BondError::BadStatus);
        // close = client returns all lamports (payment + rent).
        Ok(())
    }

    /// Agent accepts an open job; required_stake of its bond becomes locked.
    pub fn accept_job(ctx: Context<AcceptJob>) -> Result<()> {
        let job = &mut ctx.accounts.job;
        let agent = &mut ctx.accounts.agent;
        require!(job.status == JobStatus::Open, BondError::BadStatus);
        let free = agent.bond.checked_sub(agent.locked).ok_or(BondError::MathOverflow)?;
        require!(free >= job.required_stake, BondError::InsufficientFreeBond);

        agent.locked = agent
            .locked
            .checked_add(job.required_stake)
            .ok_or(BondError::MathOverflow)?;
        job.agent = agent.key();
        job.status = JobStatus::Accepted;

        emit!(JobAccepted { job: job.key(), agent: agent.key() });
        Ok(())
    }

    /// Agent submits its work. The review window starts now.
    pub fn submit_work(ctx: Context<SubmitWork>, result: String) -> Result<()> {
        require!(result.len() <= MAX_RESULT, BondError::TooLong);
        let job = &mut ctx.accounts.job;
        require!(job.status == JobStatus::Accepted, BondError::BadStatus);
        job.result = result;
        job.status = JobStatus::Submitted;
        job.submitted_at = Clock::get()?.unix_timestamp;
        emit!(WorkSubmitted { job: job.key(), agent: job.agent });
        Ok(())
    }

    /// Client is happy: payment goes to the agent, stake unlocks.
    pub fn approve_work(ctx: Context<SettleToAgent>) -> Result<()> {
        require!(ctx.accounts.job.status == JobStatus::Submitted, BondError::BadStatus);
        require_keys_eq!(
            ctx.accounts.signer.key(),
            ctx.accounts.job.client,
            BondError::Unauthorized
        );
        pay_agent(ctx)
    }

    /// Client didn't respond within the review window: agent claims payment.
    pub fn claim_timeout(ctx: Context<SettleToAgent>) -> Result<()> {
        require!(ctx.accounts.job.status == JobStatus::Submitted, BondError::BadStatus);
        require_keys_eq!(
            ctx.accounts.signer.key(),
            ctx.accounts.agent.authority,
            BondError::Unauthorized
        );
        let now = Clock::get()?.unix_timestamp;
        require!(
            now > ctx.accounts.job.submitted_at + ctx.accounts.config.review_window_secs,
            BondError::ReviewWindowOpen
        );
        pay_agent(ctx)
    }

    /// Client disputes the work within the review window.
    pub fn raise_dispute(ctx: Context<RaiseDispute>, reason: String) -> Result<()> {
        require!(reason.len() <= MAX_REASON, BondError::TooLong);
        let job = &mut ctx.accounts.job;
        require!(job.status == JobStatus::Submitted, BondError::BadStatus);
        let now = Clock::get()?.unix_timestamp;
        require!(
            now <= job.submitted_at + ctx.accounts.config.review_window_secs,
            BondError::ReviewWindowClosed
        );
        job.dispute_reason = reason;
        job.status = JobStatus::Disputed;
        emit!(DisputeRaised { job: job.key(), agent: job.agent });
        Ok(())
    }

    /// The arbiter (AI judge) rules on a dispute. The verdict text is stored
    /// on-chain so anyone can audit why an agent was (or wasn't) slashed.
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        agent_at_fault: bool,
        verdict: String,
    ) -> Result<()> {
        require!(verdict.len() <= MAX_VERDICT, BondError::TooLong);
        require!(ctx.accounts.job.status == JobStatus::Disputed, BondError::BadStatus);

        let job_info = ctx.accounts.job.to_account_info();
        let agent_info = ctx.accounts.agent.to_account_info();
        let job = &mut ctx.accounts.job;
        let agent = &mut ctx.accounts.agent;
        let stake = job.required_stake;
        agent.locked = agent.locked.saturating_sub(stake);
        job.verdict = verdict;

        if agent_at_fault {
            let slash = stake
                .checked_mul(ctx.accounts.config.slash_bps as u64)
                .ok_or(BondError::MathOverflow)?
                / BPS_DENOM;
            let slash = slash.min(agent.bond);

            let slash_fee = slash
                .checked_mul(ctx.accounts.settings.slash_fee_bps as u64)
                .ok_or(BondError::MathOverflow)?
                / BPS_DENOM;

            // Refund the client's escrowed payment in full (no fee on refunds).
            move_lamports(&job_info, &ctx.accounts.client.to_account_info(), job.payment)?;
            // Slash the bond: the platform keeps its cut, the rest compensates the client.
            if slash > slash_fee {
                move_lamports(&agent_info, &ctx.accounts.client.to_account_info(), slash - slash_fee)?;
            }
            if slash_fee > 0 {
                move_lamports(&agent_info, &ctx.accounts.treasury.to_account_info(), slash_fee)?;
            }
            job.fee_paid = slash_fee;
            let settings = &mut ctx.accounts.settings;
            settings.total_fees = settings.total_fees.checked_add(slash_fee).ok_or(BondError::MathOverflow)?;
            agent.bond -= slash;
            agent.jobs_slashed += 1;
            agent.total_slashed = agent.total_slashed.checked_add(slash).ok_or(BondError::MathOverflow)?;
            job.slashed_amount = slash;
            job.status = JobStatus::Slashed;

            emit!(AgentSlashed { job: job.key(), agent: agent.key(), amount: slash });
        } else {
            let fee = job
                .payment
                .checked_mul(ctx.accounts.settings.fee_bps as u64)
                .ok_or(BondError::MathOverflow)?
                / BPS_DENOM;
            move_lamports(
                &job_info,
                &ctx.accounts.agent_authority.to_account_info(),
                job.payment - fee,
            )?;
            if fee > 0 {
                move_lamports(&job_info, &ctx.accounts.treasury.to_account_info(), fee)?;
            }
            job.fee_paid = fee;
            let settings = &mut ctx.accounts.settings;
            settings.total_fees = settings.total_fees.checked_add(fee).ok_or(BondError::MathOverflow)?;
            agent.jobs_completed += 1;
            agent.total_earned = agent
                .total_earned
                .checked_add(job.payment)
                .ok_or(BondError::MathOverflow)?;
            job.status = JobStatus::Completed;

            emit!(JobCompleted { job: job.key(), agent: agent.key(), payment: job.payment });
        }
        Ok(())
    }
}

fn pay_agent(ctx: Context<SettleToAgent>) -> Result<()> {
    let job_info = ctx.accounts.job.to_account_info();
    let job = &mut ctx.accounts.job;
    let agent = &mut ctx.accounts.agent;
    let fee = job
        .payment
        .checked_mul(ctx.accounts.settings.fee_bps as u64)
        .ok_or(BondError::MathOverflow)?
        / BPS_DENOM;
    move_lamports(
        &job_info,
        &ctx.accounts.agent_authority.to_account_info(),
        job.payment - fee,
    )?;
    if fee > 0 {
        move_lamports(&job_info, &ctx.accounts.treasury.to_account_info(), fee)?;
    }
    job.fee_paid = fee;
    let settings = &mut ctx.accounts.settings;
    settings.total_fees = settings.total_fees.checked_add(fee).ok_or(BondError::MathOverflow)?;
    agent.locked = agent.locked.saturating_sub(job.required_stake);
    agent.jobs_completed += 1;
    agent.total_earned = agent
        .total_earned
        .checked_add(job.payment)
        .ok_or(BondError::MathOverflow)?;
    job.status = JobStatus::Completed;
    emit!(JobCompleted { job: job.key(), agent: agent.key(), payment: job.payment });
    Ok(())
}

/// Move lamports out of a program-owned account (PDA) without a CPI.
fn move_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    let from_balance = from.lamports();
    require!(from_balance >= amount, BondError::InsufficientFunds);
    **from.try_borrow_mut_lamports()? = from_balance - amount;
    **to.try_borrow_mut_lamports()? = to
        .lamports()
        .checked_add(amount)
        .ok_or(BondError::MathOverflow)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeSettings<'info> {
    #[account(init, payer = admin, space = 8 + Settings::INIT_SPACE, seeds = [b"settings"], bump)]
    pub settings: Account<'info, Settings>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = admin)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateSettings<'info> {
    #[account(mut, seeds = [b"settings"], bump = settings.bump, has_one = admin)]
    pub settings: Account<'info, Settings>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Agent::INIT_SPACE,
        seeds = [b"agent", authority.key().as_ref()],
        bump
    )]
    pub agent: Account<'info, Agent>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddBond<'info> {
    #[account(mut, seeds = [b"agent", authority.key().as_ref()], bump = agent.bump, has_one = authority)]
    pub agent: Account<'info, Agent>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawBond<'info> {
    #[account(mut, seeds = [b"agent", authority.key().as_ref()], bump = agent.bump, has_one = authority)]
    pub agent: Account<'info, Agent>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(job_id: u64)]
pub struct PostJob<'info> {
    #[account(
        init,
        payer = client,
        space = 8 + Job::INIT_SPACE,
        seeds = [b"job", client.key().as_ref(), &job_id.to_le_bytes()],
        bump
    )]
    pub job: Account<'info, Job>,
    #[account(mut)]
    pub client: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelJob<'info> {
    #[account(mut, has_one = client, close = client)]
    pub job: Account<'info, Job>,
    #[account(mut)]
    pub client: Signer<'info>,
}

#[derive(Accounts)]
pub struct AcceptJob<'info> {
    #[account(mut)]
    pub job: Account<'info, Job>,
    #[account(mut, seeds = [b"agent", authority.key().as_ref()], bump = agent.bump, has_one = authority)]
    pub agent: Account<'info, Agent>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SubmitWork<'info> {
    #[account(mut, constraint = job.agent == agent.key() @ BondError::Unauthorized)]
    pub job: Account<'info, Job>,
    #[account(seeds = [b"agent", authority.key().as_ref()], bump = agent.bump, has_one = authority)]
    pub agent: Account<'info, Agent>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct SettleToAgent<'info> {
    #[account(mut, constraint = job.agent == agent.key() @ BondError::Unauthorized)]
    pub job: Account<'info, Job>,
    #[account(mut)]
    pub agent: Account<'info, Agent>,
    /// CHECK: receives payment; must be the agent's authority.
    #[account(mut, address = agent.authority @ BondError::Unauthorized)]
    pub agent_authority: UncheckedAccount<'info>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"settings"], bump = settings.bump)]
    pub settings: Account<'info, Settings>,
    /// CHECK: receives the platform fee; must be the configured treasury.
    #[account(mut, address = settings.treasury @ BondError::Unauthorized)]
    pub treasury: UncheckedAccount<'info>,
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
pub struct RaiseDispute<'info> {
    #[account(mut, has_one = client)]
    pub job: Account<'info, Job>,
    #[account(seeds = [b"config"], bump = config.bump)]
    pub config: Account<'info, Config>,
    pub client: Signer<'info>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        has_one = client,
        constraint = job.agent == agent.key() @ BondError::Unauthorized
    )]
    pub job: Account<'info, Job>,
    #[account(mut)]
    pub agent: Account<'info, Agent>,
    /// CHECK: receives payment if agent wins; must be the agent's authority.
    #[account(mut, address = agent.authority @ BondError::Unauthorized)]
    pub agent_authority: UncheckedAccount<'info>,
    /// CHECK: receives refund + slash if agent loses; must be the job's client.
    #[account(mut)]
    pub client: UncheckedAccount<'info>,
    #[account(seeds = [b"config"], bump = config.bump, has_one = arbiter)]
    pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"settings"], bump = settings.bump)]
    pub settings: Account<'info, Settings>,
    /// CHECK: receives the platform's share; must be the configured treasury.
    #[account(mut, address = settings.treasury @ BondError::Unauthorized)]
    pub treasury: UncheckedAccount<'info>,
    pub arbiter: Signer<'info>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub arbiter: Pubkey,
    pub review_window_secs: i64,
    pub slash_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Settings {
    pub admin: Pubkey,
    /// Wallet that receives platform fees.
    pub treasury: Pubkey,
    /// Fee on every payout to an agent, in basis points (300 = 3%).
    pub fee_bps: u16,
    /// Platform share of every slash, in basis points (1000 = 10%).
    pub slash_fee_bps: u16,
    /// x25519 public key of the AI judge, used to encrypt private results.
    pub arbiter_enc_key: [u8; 32],
    /// Lifetime fees collected (lamports).
    pub total_fees: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Agent {
    pub authority: Pubkey,
    #[max_len(32)]
    pub name: String,
    #[max_len(32)]
    pub model: String,
    /// Total bond held (lamports), including the locked part.
    pub bond: u64,
    /// Part of the bond staked on in-progress jobs.
    pub locked: u64,
    pub jobs_completed: u32,
    pub jobs_slashed: u32,
    pub total_earned: u64,
    pub total_slashed: u64,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum JobStatus {
    Open,
    Accepted,
    Submitted,
    Disputed,
    Completed,
    Slashed,
}

#[account]
#[derive(InitSpace)]
pub struct Job {
    pub client: Pubkey,
    pub job_id: u64,
    pub agent: Pubkey,
    pub payment: u64,
    pub required_stake: u64,
    pub status: JobStatus,
    #[max_len(280)]
    pub spec: String,
    /// Encrypted for the client and the judge: "enc1:" + base64 envelope.
    #[max_len(1200)]
    pub result: String,
    #[max_len(200)]
    pub dispute_reason: String,
    #[max_len(280)]
    pub verdict: String,
    pub slashed_amount: u64,
    pub created_at: i64,
    pub submitted_at: i64,
    pub bump: u8,
    // added in v2: old jobs read these from their zeroed spare space
    /// Client's x25519 public key; agents encrypt the result to it.
    pub enc_key: [u8; 32],
    /// Platform fee taken when this job settled (lamports).
    pub fee_paid: u64,
}

// ---------------------------------------------------------------------------
// Events & errors
// ---------------------------------------------------------------------------

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub authority: Pubkey,
    pub bond: u64,
}

#[event]
pub struct JobPosted {
    pub job: Pubkey,
    pub client: Pubkey,
    pub payment: u64,
    pub required_stake: u64,
}

#[event]
pub struct JobAccepted {
    pub job: Pubkey,
    pub agent: Pubkey,
}

#[event]
pub struct WorkSubmitted {
    pub job: Pubkey,
    pub agent: Pubkey,
}

#[event]
pub struct DisputeRaised {
    pub job: Pubkey,
    pub agent: Pubkey,
}

#[event]
pub struct JobCompleted {
    pub job: Pubkey,
    pub agent: Pubkey,
    pub payment: u64,
}

#[event]
pub struct AgentSlashed {
    pub job: Pubkey,
    pub agent: Pubkey,
    pub amount: u64,
}

#[error_code]
pub enum BondError {
    #[msg("Invalid parameter")]
    InvalidParam,
    #[msg("String too long")]
    TooLong,
    #[msg("Not enough free (unlocked) bond")]
    InsufficientFreeBond,
    #[msg("Job is not in the right status for this action")]
    BadStatus,
    #[msg("Not authorized")]
    Unauthorized,
    #[msg("Review window is still open")]
    ReviewWindowOpen,
    #[msg("Review window has closed")]
    ReviewWindowClosed,
    #[msg("Insufficient funds in account")]
    InsufficientFunds,
    #[msg("Math overflow")]
    MathOverflow,
}
