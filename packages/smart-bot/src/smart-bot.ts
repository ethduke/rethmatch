// Smart RethMatch Bot - Using MUD sync system with intelligent game decisions

import "dotenv/config";
import cliProgress from "cli-progress";
import { 
  http, 
  fallback, 
  webSocket,
  createPublicClient, 
  createWalletClient, 
  type WalletClient
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { forwardStateTo, LiveState, parseSyncStateGivenTables } from "../../client/src/utils/sync";
import { EntityType } from "../../client/src/utils/game/entityLib";
import { GameConfig } from "../../client/src/utils/game/configLib";
import { stash } from "../../client/src/mud/stash";
import { timeWad } from "../../client/src/utils/timeLib";
import { ODYSSEY_CHAIN } from "../../client/src/utils/chains";

import { syncToStash } from "@latticexyz/store-sync/internal";
import { Stash } from "@latticexyz/stash/internal";

import Worlds from "../../contracts/worlds.json";

const chain = ODYSSEY_CHAIN;
const WORLD_ADDRESS = Worlds[chain.id]?.address as `0x${string}`;
if (!WORLD_ADDRESS) throw new Error(`No world address found for chain ${chain.id}`);
const START_BLOCK = Worlds[chain.id]!.blockNumber!;

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}`;
if (!PRIVATE_KEY) throw new Error("PRIVATE_KEY environment variable is required");

const account = privateKeyToAccount(PRIVATE_KEY);

interface BotState {
  isAlive: boolean;
  currentLine: number;
  lastAction: string;
  lastActionTime: bigint;
  myEntityId: bigint | null;
  actionCooldown: bigint;
  consecutiveFailures: number;
}

let botState: BotState = {
  isAlive: false,
  currentLine: 0,
  lastAction: 'none',
  lastActionTime: 0n,
  myEntityId: null,
  actionCooldown: 2_000_000_000_000_000_000n,
  consecutiveFailures: 0,
};

const walletClient: WalletClient = createWalletClient({
  account,
  chain,
  transport: http("https://odyssey.ithaca.xyz"),
});

function computeEntityId(address: string): bigint {
  const seed = BigInt(address);
  const UINT144_MAX = (1n << 144n) - 1n;
  return (seed % UINT144_MAX) + 1n;
}

function rightmostEntityId(line: number): bigint {
  const UINT152_MAX = (1n << 152n) - 1n;
  return UINT152_MAX + BigInt(line);
}

const SPAWN_ABI = [
  {
    name: "spawn",
    type: "function",
    inputs: [
      { name: "line", type: "uint32" },
      { name: "rightNeighbor", type: "uint160" },
      { name: "velRight", type: "bool" }
    ],
    outputs: [{ name: "entityId", type: "uint160" }],
    stateMutability: "nonpayable"
  }
] as const;

const DIRECTION_ABI = [
  {
    name: "setDirection",
    type: "function",
    inputs: [{ name: "velRight", type: "bool" }],
    outputs: [],
    stateMutability: "nonpayable"
  }
] as const;

const JUMP_ABI = [
  {
    name: "jumpToLine",
    type: "function",
    inputs: [{ name: "up", type: "bool" }],
    outputs: [{ name: "newLine", type: "uint32" }],
    stateMutability: "nonpayable"
  }
] as const;

function onBlock(liveState: LiveState, gameConfig: GameConfig, wadTime: bigint) {
  const { lines, gameState } = liveState;
  
  console.log(`\n🎮 Block update - Time: ${wadTime}`);
  
  if (!botState.myEntityId) {
    botState.myEntityId = computeEntityId(account.address);
    console.log("🆔 Bot Entity ID:", botState.myEntityId);
  }
  
  const myEntity = findMyEntity(lines, botState.myEntityId);
  
  if (myEntity) {
    if (!botState.isAlive) {
      console.log("✅ Bot is now ALIVE!");
      botState.isAlive = true;
    }
    
    botState.currentLine = myEntity.lineId;
    console.log(`🤖 Bot on line ${botState.currentLine}, mass: ${myEntity.mass}`);
    
    const decision = analyzeGameStateAndDecide(lines, myEntity, gameConfig, wadTime);
    
    const timeSinceLastAction = wadTime - botState.lastActionTime;
    if (timeSinceLastAction >= botState.actionCooldown) {
      console.log(`🧠 DECISION: ${decision.reasoning}`);
      executeDecision(decision);
    } else {
      const waitTime = Number(botState.actionCooldown - timeSinceLastAction) / 1_000_000_000_000_000_000;
      console.log(`⏱️  Cooldown: ${waitTime.toFixed(1)}s remaining`);
    }
    
  } else {
    if (botState.isAlive) {
      console.log("💀 Bot died!");
      botState.isAlive = false;
      botState.consecutiveFailures = 0;
    }
    
    const timeSinceLastAction = wadTime - botState.lastActionTime;
    const spawnCooldown = 5_000_000_000_000_000_000n;
    
    if (timeSinceLastAction >= spawnCooldown) {
      console.log("🔄 Attempting to spawn...");
      attemptSpawn(lines);
    } else {
      const waitTime = Number(spawnCooldown - timeSinceLastAction) / 1_000_000_000_000_000_000;
      console.log(`⏳ Spawn cooldown: ${waitTime.toFixed(1)}s`);
    }
  }
  
  showGameStateInfo(lines, gameState);
}

function findMyEntity(lines: any[][], myEntityId: bigint) {
  for (const line of lines) {
    if (!line) continue;
    const entity = line.find(e => e.entityId === myEntityId && e.etype === EntityType.ALIVE);
    if (entity) return entity;
  }
  return null;
}

function analyzeGameStateAndDecide(lines: any[][], myEntity: any, gameConfig: GameConfig, wadTime: bigint) {
  const currentLine = myEntity.lineId;
  const myMass = myEntity.mass;
  
  // Define all possible actions
  const possibleActions = [
    { type: 'jump', up: true, targetLine: currentLine - 1, direction: 'UP' },
    { type: 'jump', up: false, targetLine: currentLine + 1, direction: 'DOWN' },
    { type: 'direction', velRight: false, targetLine: currentLine, direction: 'LEFT' },
    { type: 'direction', velRight: true, targetLine: currentLine, direction: 'RIGHT' }
  ];
  
  // Score all actions
  const scoredActions = possibleActions.map(action => scoreAction(lines, action, currentLine, myMass));
  
  // Sort by score and pick the best
  scoredActions.sort((a, b) => b.score - a.score);
  const best = scoredActions[0];
  
  console.log(`🎯 Action scores: ${scoredActions.map(a => `${a.reasoning.split(':')[0]}:${a.score}`).join(', ')}`);
  
  return {
    action: best.action,
    details: best.details,
    reasoning: best.reasoning
  };
}

function scoreAction(lines: any[][], action: any, currentLine: number, myMass: number) {
  const { type, targetLine, direction } = action;
  
  // Check bounds and emergency conditions
  if (targetLine < 0) {
    return { action: type, details: getActionDetails(action), score: -1000, reasoning: `${direction}: Out of bounds` };
  }
  if (targetLine >= lines.length) {
    return { action: type, details: getActionDetails(action), score: -1000, reasoning: `${direction}: Out of bounds` };
  }
  
  // Emergency escape from edge lines
  if (currentLine <= 1 && type === 'jump' && !action.up) {
    return { action: type, details: getActionDetails(action), score: 1000, reasoning: `${direction}: EMERGENCY escape from top` };
  }
  if (currentLine >= 6 && type === 'jump' && action.up) {
    return { action: type, details: getActionDetails(action), score: 1000, reasoning: `${direction}: EMERGENCY escape from bottom` };
  }
  
  // Score the target line opportunity
  return scoreLineOpportunity(lines, targetLine, myMass, type, getActionDetails(action), direction);
}

function getActionDetails(action: any) {
  if (action.type === 'jump') {
    return { up: action.up };
  } else {
    return { velRight: action.velRight };
  }
}

// Score the opportunity value of a specific line
function scoreLineOpportunity(lines: any[][], lineId: number, myMass: number, action: string, details: any, direction: string): any {
  const entities = lines[lineId] || [];
  
  // Count entities
  const threats = entities.filter(e => e.etype === EntityType.ALIVE && e.mass > myMass).length;
  const prey = entities.filter(e => e.etype === EntityType.ALIVE && e.mass < myMass).length;
  const food = entities.filter(e => e.etype === EntityType.FOOD).length;
  const powerPellets = entities.filter(e => e.etype === EntityType.POWER_PELLET).length;
  const totalPlayers = entities.filter(e => e.etype === EntityType.ALIVE).length;
  
  // Calculate score
  let score = 0;
  score += powerPellets * 50;                           // Power pellets priority
  score += food * (threats === 0 ? 10 : 2);            // Food value depends on safety
  score += prey * 20;                                   // Prey value
  score -= threats * 30;                                // Threat penalty
  score += (lineId >= 2 && lineId <= 5) ? 5 : 0;       // Center line bonus
  score -= (totalPlayers > 3) ? 10 : 0;                // Overcrowding penalty
  
  const items = [
    powerPellets > 0 ? `${powerPellets}P` : '',
    food > 0 ? `${food}F` : '',
    prey > 0 ? `${prey}prey` : '',
    threats > 0 ? `${threats}threats` : ''
  ].filter(Boolean).join(',');
  
  return {
    action: action as 'jump' | 'direction',
    details,
    score,
    reasoning: `${direction}(${items || 'empty'})`
  };
}

async function executeDecision(decision: any) {
  try {
    botState.lastActionTime = timeWad();
    
    const hash = await executeAction(decision.action, decision.details);
    console.log(`✅ ${decision.action === 'jump' ? 'Jumped' : 'Direction changed'}:`, hash);
    
    botState.lastAction = decision.action === 'jump' ? 
      `jump_${decision.details.up ? 'up' : 'down'}` : 
      `direction_${decision.details.velRight ? 'right' : 'left'}`;
    
    if (decision.action === 'jump' && botState.isAlive) {
      botState.currentLine = decision.details.up ? 
        Math.max(0, botState.currentLine - 1) : 
        Math.min(7, botState.currentLine + 1);
    }
    
    botState.consecutiveFailures = 0;
    botState.actionCooldown = 1_500_000_000_000_000_000n;
    
  } catch (error: any) {
    console.error("❌ Decision execution failed:", error.message?.substring(0, 100) || 'Unknown error');
    
    if (error.message?.includes('CALLER_IS_NOT_ALIVE') || error.message?.includes('caller is not alive')) {
      console.log("💀 Bot died during action!");
      botState.isAlive = false;
    }
    
    botState.consecutiveFailures++;
    const maxCooldown = 5_000_000_000_000_000_000n;
    const additionalCooldown = BigInt(botState.consecutiveFailures) * 500_000_000_000_000_000n;
    const newCooldown = botState.actionCooldown + additionalCooldown;
    botState.actionCooldown = newCooldown > maxCooldown ? maxCooldown : newCooldown;
  }
}

async function executeAction(actionType: string, details: any) {
  if (actionType === 'jump') {
    return await walletClient.writeContract({
      address: WORLD_ADDRESS,
      abi: JUMP_ABI,
      functionName: 'jumpToLine',
      args: [details.up],
      chain,
      account,
    });
  } else {
    return await walletClient.writeContract({
      address: WORLD_ADDRESS,
      abi: DIRECTION_ABI,
      functionName: 'setDirection',
      args: [details.velRight],
      chain,
      account,
    });
  }
}

async function attemptSpawn(lines: any[][]) {
  try {
    const cornerLines = [2, 4];
    let bestLine = cornerLines[Math.floor(Math.random() * cornerLines.length)];
    
    for (const lineId of cornerLines) {
      const lineEntities = lines[lineId] || [];
      const alivePlayers = lineEntities.filter(e => e.etype === EntityType.ALIVE).length;
      if (alivePlayers < 3) {
        bestLine = lineId;
        break;
      }
    }
    
    console.log(`🎯 Spawning on line ${bestLine}...`);
    
    const hash = await walletClient.writeContract({
      address: WORLD_ADDRESS,
      abi: SPAWN_ABI,
      functionName: "spawn",
      args: [bestLine, rightmostEntityId(bestLine), true],
      chain,
      account,
    });
    
    console.log("✅ Spawn transaction sent:", hash);
    botState.lastAction = 'spawn';
    botState.lastActionTime = timeWad();
    
  } catch (error: any) {
    if (error.message?.includes('CALLER_IS_ALIVE')) {
      console.log("🎉 Bot is already alive!");
      botState.isAlive = true;
    } else if (error.message?.includes('NO_ACCESS')) {
      console.error("❌ Authentication required! Please complete X/Twitter linking first");
      botState.actionCooldown = 30_000_000_000_000_000_000n;
    } else {
      console.error("❌ Spawn failed:", error.message?.substring(0, 100) || 'Unknown error');
    }
  }
}

function showGameStateInfo(lines: any[][], gameState: any) {
  lines.forEach((line, idx) => {
    if (!line) return;
    
    const players = line
      .filter(entity => entity.etype === EntityType.ALIVE && gameState.usernames.has(entity.entityId))
      .map(entity => gameState.usernames.get(entity.entityId));
    
    const food = line.filter(e => e.etype === EntityType.FOOD).length;
    const pellets = line.filter(e => e.etype === EntityType.POWER_PELLET).length;
    
    if (players.length > 0 || food > 0 || pellets > 0) {
      console.log(
        `Line ${idx}: ${players.length > 0 ? players.join(", ") : "No players"} | Food: ${food} | Pellets: ${pellets}`
      );
    }
  });
}

export async function main() {
  console.log("🤖 Smart RethMatch Bot Starting...");
  console.log("📡 World Address:", WORLD_ADDRESS);
  console.log("🎮 Bot Address:", account.address);
  console.log("🔗 Chain:", chain.name);
  
  const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
  
  const { storedBlockLogs$ } = await syncToStash({
    stash: stash as Stash,
    startSync: true,
    address: WORLD_ADDRESS,
    startBlock: BigInt(START_BLOCK ?? 0),
    publicClient: createPublicClient({
      chain,
      transport: fallback([webSocket(), http()]),
      pollingInterval: 100,
      cacheTime: 100,
    }),
    indexerUrl: chain.indexerUrl,
  });
  
  progressBar.start(100, 0);
  
  storedBlockLogs$.subscribe(() => {
    const { syncProgress, data } = parseSyncStateGivenTables(stash.get());
    
    if (syncProgress.step === "live" && data) {
      if (progressBar.isActive) {
        progressBar.update(100);
        progressBar.stop();
        console.log("\n✅ Caught up with blockchain!");
      }
      
      const syncedState = {
        lastSyncedTime: performance.now(),
        lastProcessedTime: -1n,
        lines: data.lines,
        lineStates: data.lineStates,
        gameState: data.gameState,
      };
      
      const liveState = forwardStateTo(syncedState, data.gameConfig, false, null, {
        stopAtIteration: null,
        stopAtTimestampWad: null,
      });
      
      console.log("\n📥 Block:", Number(syncProgress.latestBlockNumber));
      onBlock(liveState, data.gameConfig, timeWad());
      
    } else {
      if (syncProgress.step === "snapshot") progressBar.update(0);
      else progressBar.update(Math.round(syncProgress.percentage));
    }
  });
  
  process.on('SIGINT', () => {
    console.log("\n\n🛑 Shutting down bot...");
    process.exit(0);
  });
}

console.log("🚀 Starting Smart RethMatch Bot with MUD Sync...");
console.log("💡 Features: Real-time game state analysis, intelligent decisions, block-based actions");
console.log();

main().catch(console.error); 