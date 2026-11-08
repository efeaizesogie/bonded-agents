// Anchor IDL for programs/bonded_agents (Anchor 0.30+ spec, camelCase like target/types/bonded_agents.ts).
// Hand-written to match lib.rs so the app works before `anchor build`.
// After building, `target/idl/bonded_agents.json` should be equivalent; if you
// change the program, regenerate and paste it here (keep both the type and the value in sync).

export type BondedAgents = {
  "address": "jVwyysSicpg9RtaiXtyuuWTNC8GGE41K1qcGPjAH29F",
  "metadata": {
    "name": "bonded_agents",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "acceptJob",
      "discriminator": [
        43,
        201,
        124,
        1,
        19,
        189,
        96,
        10
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "addBond",
      "discriminator": [
        67,
        104,
        1,
        227,
        44,
        237,
        39,
        95
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "approveWork",
      "discriminator": [
        181,
        118,
        45,
        143,
        204,
        88,
        237,
        109
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentAuthority",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "cancelJob",
      "discriminator": [
        126,
        241,
        155,
        241,
        50,
        236,
        83,
        118
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "client",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimTimeout",
      "discriminator": [
        130,
        234,
        45,
        53,
        120,
        90,
        86,
        178
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentAuthority",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "arbiter",
          "type": "pubkey"
        },
        {
          "name": "reviewWindowSecs",
          "type": "i64"
        },
        {
          "name": "slashBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeSettings",
      "discriminator": [
        71,
        239,
        156,
        98,
        109,
        81,
        123,
        78
      ],
      "accounts": [
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        },
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "slashFeeBps",
          "type": "u16"
        },
        {
          "name": "arbiterEncKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "postJob",
      "discriminator": [
        34,
        208,
        58,
        248,
        129,
        234,
        179,
        211
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "client",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "jobId",
          "type": "u64"
        },
        {
          "name": "payment",
          "type": "u64"
        },
        {
          "name": "requiredStake",
          "type": "u64"
        },
        {
          "name": "spec",
          "type": "string"
        },
        {
          "name": "encKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "raiseDispute",
      "discriminator": [
        41,
        243,
        1,
        51,
        150,
        95,
        246,
        73
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "client",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "registerAgent",
      "discriminator": [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "model",
          "type": "string"
        },
        {
          "name": "bondLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveDispute",
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentAuthority",
          "writable": true
        },
        {
          "name": "client",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "arbiter",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "agentAtFault",
          "type": "bool"
        },
        {
          "name": "verdict",
          "type": "string"
        }
      ]
    },
    {
      "name": "submitWork",
      "discriminator": [
        158,
        80,
        101,
        51,
        114,
        130,
        101,
        253
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent"
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "result",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "arbiter",
          "type": "pubkey"
        },
        {
          "name": "reviewWindowSecs",
          "type": "i64"
        },
        {
          "name": "slashBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateSettings",
      "discriminator": [
        81,
        166,
        51,
        213,
        158,
        84,
        157,
        108
      ],
      "accounts": [
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        },
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "slashFeeBps",
          "type": "u16"
        },
        {
          "name": "arbiterEncKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "withdrawBond",
      "discriminator": [
        222,
        199,
        141,
        31,
        188,
        93,
        155,
        40
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agent",
      "discriminator": [
        47,
        166,
        112,
        147,
        155,
        197,
        86,
        7
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "job",
      "discriminator": [
        75,
        124,
        80,
        203,
        161,
        180,
        202,
        80
      ]
    },
    {
      "name": "settings",
      "discriminator": [
        223,
        179,
        163,
        190,
        177,
        224,
        67,
        173
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidParam",
      "msg": "Invalid parameter"
    },
    {
      "code": 6001,
      "name": "TooLong",
      "msg": "String too long"
    },
    {
      "code": 6002,
      "name": "InsufficientFreeBond",
      "msg": "Not enough free (unlocked) bond"
    },
    {
      "code": 6003,
      "name": "BadStatus",
      "msg": "Job is not in the right status for this action"
    },
    {
      "code": 6004,
      "name": "Unauthorized",
      "msg": "Not authorized"
    },
    {
      "code": 6005,
      "name": "ReviewWindowOpen",
      "msg": "Review window is still open"
    },
    {
      "code": 6006,
      "name": "ReviewWindowClosed",
      "msg": "Review window has closed"
    },
    {
      "code": 6007,
      "name": "InsufficientFunds",
      "msg": "Insufficient funds in account"
    },
    {
      "code": 6008,
      "name": "MathOverflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "agent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "model",
            "type": "string"
          },
          {
            "name": "bond",
            "type": "u64"
          },
          {
            "name": "locked",
            "type": "u64"
          },
          {
            "name": "jobsCompleted",
            "type": "u32"
          },
          {
            "name": "jobsSlashed",
            "type": "u32"
          },
          {
            "name": "totalEarned",
            "type": "u64"
          },
          {
            "name": "totalSlashed",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "arbiter",
            "type": "pubkey"
          },
          {
            "name": "reviewWindowSecs",
            "type": "i64"
          },
          {
            "name": "slashBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "job",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "payment",
            "type": "u64"
          },
          {
            "name": "requiredStake",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "jobStatus"
              }
            }
          },
          {
            "name": "spec",
            "type": "string"
          },
          {
            "name": "result",
            "type": "string"
          },
          {
            "name": "disputeReason",
            "type": "string"
          },
          {
            "name": "verdict",
            "type": "string"
          },
          {
            "name": "slashedAmount",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "submittedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "encKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "feePaid",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "jobStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Open"
          },
          {
            "name": "Accepted"
          },
          {
            "name": "Submitted"
          },
          {
            "name": "Disputed"
          },
          {
            "name": "Completed"
          },
          {
            "name": "Slashed"
          }
        ]
      }
    },
    {
      "name": "settings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "slashFeeBps",
            "type": "u16"
          },
          {
            "name": "arbiterEncKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalFees",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};

export const IDL: BondedAgents = {
  "address": "jVwyysSicpg9RtaiXtyuuWTNC8GGE41K1qcGPjAH29F",
  "metadata": {
    "name": "bonded_agents",
    "version": "0.1.0",
    "spec": "0.1.0"
  },
  "instructions": [
    {
      "name": "acceptJob",
      "discriminator": [
        43,
        201,
        124,
        1,
        19,
        189,
        96,
        10
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "addBond",
      "discriminator": [
        67,
        104,
        1,
        227,
        44,
        237,
        39,
        95
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "approveWork",
      "discriminator": [
        181,
        118,
        45,
        143,
        204,
        88,
        237,
        109
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentAuthority",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "cancelJob",
      "discriminator": [
        126,
        241,
        155,
        241,
        50,
        236,
        83,
        118
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "client",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "claimTimeout",
      "discriminator": [
        130,
        234,
        45,
        53,
        120,
        90,
        86,
        178
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentAuthority",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "signer",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "arbiter",
          "type": "pubkey"
        },
        {
          "name": "reviewWindowSecs",
          "type": "i64"
        },
        {
          "name": "slashBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "initializeSettings",
      "discriminator": [
        71,
        239,
        156,
        98,
        109,
        81,
        123,
        78
      ],
      "accounts": [
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        },
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "slashFeeBps",
          "type": "u16"
        },
        {
          "name": "arbiterEncKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "postJob",
      "discriminator": [
        34,
        208,
        58,
        248,
        129,
        234,
        179,
        211
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "client",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "jobId",
          "type": "u64"
        },
        {
          "name": "payment",
          "type": "u64"
        },
        {
          "name": "requiredStake",
          "type": "u64"
        },
        {
          "name": "spec",
          "type": "string"
        },
        {
          "name": "encKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "raiseDispute",
      "discriminator": [
        41,
        243,
        1,
        51,
        150,
        95,
        246,
        73
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "client",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "reason",
          "type": "string"
        }
      ]
    },
    {
      "name": "registerAgent",
      "discriminator": [
        135,
        157,
        66,
        195,
        2,
        113,
        175,
        30
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "model",
          "type": "string"
        },
        {
          "name": "bondLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "resolveDispute",
      "discriminator": [
        231,
        6,
        202,
        6,
        96,
        103,
        12,
        230
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "agentAuthority",
          "writable": true
        },
        {
          "name": "client",
          "writable": true
        },
        {
          "name": "config"
        },
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "arbiter",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "agentAtFault",
          "type": "bool"
        },
        {
          "name": "verdict",
          "type": "string"
        }
      ]
    },
    {
      "name": "submitWork",
      "discriminator": [
        158,
        80,
        101,
        51,
        114,
        130,
        101,
        253
      ],
      "accounts": [
        {
          "name": "job",
          "writable": true
        },
        {
          "name": "agent"
        },
        {
          "name": "authority",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "result",
          "type": "string"
        }
      ]
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "arbiter",
          "type": "pubkey"
        },
        {
          "name": "reviewWindowSecs",
          "type": "i64"
        },
        {
          "name": "slashBps",
          "type": "u16"
        }
      ]
    },
    {
      "name": "updateSettings",
      "discriminator": [
        81,
        166,
        51,
        213,
        158,
        84,
        157,
        108
      ],
      "accounts": [
        {
          "name": "settings",
          "writable": true
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "treasury",
          "type": "pubkey"
        },
        {
          "name": "feeBps",
          "type": "u16"
        },
        {
          "name": "slashFeeBps",
          "type": "u16"
        },
        {
          "name": "arbiterEncKey",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "withdrawBond",
      "discriminator": [
        222,
        199,
        141,
        31,
        188,
        93,
        155,
        40
      ],
      "accounts": [
        {
          "name": "agent",
          "writable": true
        },
        {
          "name": "authority",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "agent",
      "discriminator": [
        47,
        166,
        112,
        147,
        155,
        197,
        86,
        7
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "job",
      "discriminator": [
        75,
        124,
        80,
        203,
        161,
        180,
        202,
        80
      ]
    },
    {
      "name": "settings",
      "discriminator": [
        223,
        179,
        163,
        190,
        177,
        224,
        67,
        173
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidParam",
      "msg": "Invalid parameter"
    },
    {
      "code": 6001,
      "name": "TooLong",
      "msg": "String too long"
    },
    {
      "code": 6002,
      "name": "InsufficientFreeBond",
      "msg": "Not enough free (unlocked) bond"
    },
    {
      "code": 6003,
      "name": "BadStatus",
      "msg": "Job is not in the right status for this action"
    },
    {
      "code": 6004,
      "name": "Unauthorized",
      "msg": "Not authorized"
    },
    {
      "code": 6005,
      "name": "ReviewWindowOpen",
      "msg": "Review window is still open"
    },
    {
      "code": 6006,
      "name": "ReviewWindowClosed",
      "msg": "Review window has closed"
    },
    {
      "code": 6007,
      "name": "InsufficientFunds",
      "msg": "Insufficient funds in account"
    },
    {
      "code": 6008,
      "name": "MathOverflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "agent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "model",
            "type": "string"
          },
          {
            "name": "bond",
            "type": "u64"
          },
          {
            "name": "locked",
            "type": "u64"
          },
          {
            "name": "jobsCompleted",
            "type": "u32"
          },
          {
            "name": "jobsSlashed",
            "type": "u32"
          },
          {
            "name": "totalEarned",
            "type": "u64"
          },
          {
            "name": "totalSlashed",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "arbiter",
            "type": "pubkey"
          },
          {
            "name": "reviewWindowSecs",
            "type": "i64"
          },
          {
            "name": "slashBps",
            "type": "u16"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "job",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "client",
            "type": "pubkey"
          },
          {
            "name": "jobId",
            "type": "u64"
          },
          {
            "name": "agent",
            "type": "pubkey"
          },
          {
            "name": "payment",
            "type": "u64"
          },
          {
            "name": "requiredStake",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "jobStatus"
              }
            }
          },
          {
            "name": "spec",
            "type": "string"
          },
          {
            "name": "result",
            "type": "string"
          },
          {
            "name": "disputeReason",
            "type": "string"
          },
          {
            "name": "verdict",
            "type": "string"
          },
          {
            "name": "slashedAmount",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "submittedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "encKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "feePaid",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "jobStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Open"
          },
          {
            "name": "Accepted"
          },
          {
            "name": "Submitted"
          },
          {
            "name": "Disputed"
          },
          {
            "name": "Completed"
          },
          {
            "name": "Slashed"
          }
        ]
      }
    },
    {
      "name": "settings",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "treasury",
            "type": "pubkey"
          },
          {
            "name": "feeBps",
            "type": "u16"
          },
          {
            "name": "slashFeeBps",
            "type": "u16"
          },
          {
            "name": "arbiterEncKey",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalFees",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
