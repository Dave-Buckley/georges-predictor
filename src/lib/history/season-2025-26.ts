/**
 * Final league table for the 2025/26 season — immutable historical record.
 *
 * Snapshotted from live members.starting_points on 2026-07-05T11:46:29.395Z
 * (season ended 2026-07-01) BEFORE the 2026/27 reset zeroed those totals.
 * Regenerate with: npx tsx scripts/generate-season-2025-archive.ts
 * Placeholder / excluded accounts are omitted.
 */

export interface ArchivedStanding {
  rank: number
  name: string
  points: number
}

export const SEASON_2025_26 = {
  label: '2025/26',
  season: 2025,
  champion: "Big Steve",
  runnerUp: "Eric",
  third: "Harry",
  table: [
    {
      "rank": 1,
      "name": "Big Steve",
      "points": 3390
    },
    {
      "rank": 2,
      "name": "Eric",
      "points": 3260
    },
    {
      "rank": 3,
      "name": "Harry",
      "points": 3210
    },
    {
      "rank": 4,
      "name": "Dan The Man",
      "points": 3190
    },
    {
      "rank": 5,
      "name": "Dave",
      "points": 3160
    },
    {
      "rank": 6,
      "name": "Michael",
      "points": 3140
    },
    {
      "rank": 7,
      "name": "Stu",
      "points": 3130
    },
    {
      "rank": 8,
      "name": "Darren",
      "points": 3100
    },
    {
      "rank": 9,
      "name": "Rohan",
      "points": 3090
    },
    {
      "rank": 9,
      "name": "Jack",
      "points": 3090
    },
    {
      "rank": 11,
      "name": "Martyn",
      "points": 3070
    },
    {
      "rank": 12,
      "name": "Hugo",
      "points": 3060
    },
    {
      "rank": 13,
      "name": "Craig",
      "points": 3050
    },
    {
      "rank": 14,
      "name": "Liam",
      "points": 3040
    },
    {
      "rank": 15,
      "name": "Papa Spam",
      "points": 3020
    },
    {
      "rank": 16,
      "name": "Pete",
      "points": 3000
    },
    {
      "rank": 17,
      "name": "Winston",
      "points": 2990
    },
    {
      "rank": 17,
      "name": "Eddie",
      "points": 2990
    },
    {
      "rank": 19,
      "name": "Big Sean",
      "points": 2970
    },
    {
      "rank": 20,
      "name": "Jimmy",
      "points": 2940
    },
    {
      "rank": 21,
      "name": "George",
      "points": 2930
    },
    {
      "rank": 21,
      "name": "Jonni",
      "points": 2930
    },
    {
      "rank": 23,
      "name": "Rich",
      "points": 2920
    },
    {
      "rank": 23,
      "name": "Mike",
      "points": 2920
    },
    {
      "rank": 23,
      "name": "Leon",
      "points": 2920
    },
    {
      "rank": 26,
      "name": "Ashley",
      "points": 2910
    },
    {
      "rank": 27,
      "name": "Bert",
      "points": 2860
    },
    {
      "rank": 28,
      "name": "Shaun",
      "points": 2850
    },
    {
      "rank": 29,
      "name": "Sunny",
      "points": 2840
    },
    {
      "rank": 30,
      "name": "Leigh-Ann",
      "points": 2810
    },
    {
      "rank": 30,
      "name": "Barny",
      "points": 2810
    },
    {
      "rank": 32,
      "name": "Tom",
      "points": 2800
    },
    {
      "rank": 32,
      "name": "Sammy",
      "points": 2800
    },
    {
      "rank": 34,
      "name": "Anna",
      "points": 2780
    },
    {
      "rank": 34,
      "name": "Danny",
      "points": 2780
    },
    {
      "rank": 34,
      "name": "Dan",
      "points": 2780
    },
    {
      "rank": 37,
      "name": "Louis",
      "points": 2730
    },
    {
      "rank": 38,
      "name": "Lewis",
      "points": 2720
    },
    {
      "rank": 39,
      "name": "Dad",
      "points": 2700
    },
    {
      "rank": 40,
      "name": "Grant",
      "points": 2690
    },
    {
      "rank": 41,
      "name": "Phil",
      "points": 2640
    },
    {
      "rank": 42,
      "name": "Matt",
      "points": 2630
    },
    {
      "rank": 43,
      "name": "Luke",
      "points": 2540
    },
    {
      "rank": 44,
      "name": "Jim",
      "points": 2500
    },
    {
      "rank": 45,
      "name": "Milly",
      "points": 2410
    },
    {
      "rank": 46,
      "name": "Steve",
      "points": 2360
    },
    {
      "rank": 47,
      "name": "Charlie",
      "points": 2140
    },
    {
      "rank": 48,
      "name": "Obi",
      "points": 1460
    },
    {
      "rank": 49,
      "name": "Ralph",
      "points": 0
    }
  ] as ArchivedStanding[],
} as const
