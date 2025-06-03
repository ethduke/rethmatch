// Smart RethMatch Bot - Using MUD sync system with proper onBlock logic
// Based on the example bot structure but with intelligent game decisions
import "dotenv/config";
import cliProgress from "cli-progress";
import { http, fallback, webSocket, createPublicClient, createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
// MUD imports (like example bot)
import { forwardStateTo, parseSyncStateGivenTables } from "../../client/src/utils/sync";
import { EntityType } from "../../client/src/utils/game/entityLib";
import { stash } from "../../client/src/mud/stash";
import { timeWad } from "../../client/src/utils/timeLib";
import { ODYSSEY_CHAIN } from "../../client/src/utils/chains";
import { syncToStash } from "@latticexyz/store-sync/internal";
import Worlds from "../../contracts/worlds.json";
// Setup chain and world
const chain = ODYSSEY_CHAIN;
const WORLD_ADDRESS = Worlds[chain.id]?.address;
if (!WORLD_ADDRESS)
    throw new Error(`No world address found for chain ${chain.id}`);
const START_BLOCK = Worlds[chain.id].blockNumber;
// Bot configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY;
if (!PRIVATE_KEY)
    throw new Error("PRIVATE_KEY environment variable is required");
const account = privateKeyToAccount(PRIVATE_KEY);
let botState = {
    isAlive: false,
    currentLine: 0,
    lastAction: 'none',
    lastActionTime: 0n,
    strategy: 'collect',
    myEntityId: null,
    actionCooldown: 2000000000000000000n, // 2 seconds default cooldown
    consecutiveFailures: 0,
};
// Create wallet client for transactions
const walletClient = createWalletClient({
    account,
    chain,
    transport: http("https://odyssey.ithaca.xyz"), // Use HTTP only for transactions
});
// Utility functions
function computeEntityId(address) {
    const seed = BigInt(address);
    const UINT144_MAX = (1n << 144n) - 1n;
    return (seed % UINT144_MAX) + 1n;
}
function rightmostEntityId(line) {
    const UINT152_MAX = (1n << 152n) - 1n;
    return UINT152_MAX + BigInt(line);
}
// Smart contract ABIs
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
];
const DIRECTION_ABI = [
    {
        name: "setDirection",
        type: "function",
        inputs: [{ name: "velRight", type: "bool" }],
        outputs: [],
        stateMutability: "nonpayable"
    }
];
const JUMP_ABI = [
    {
        name: "jumpToLine",
        type: "function",
        inputs: [{ name: "up", type: "bool" }],
        outputs: [{ name: "newLine", type: "uint32" }],
        stateMutability: "nonpayable"
    }
];
// MAIN BOT LOGIC - This is called every block with real game state
function onBlock(liveState, gameConfig, wadTime) {
    const { lines, gameState } = liveState;
    console.log(`\n🎮 Block update received - Current time: ${wadTime}`);
    // Initialize our entity ID if not set
    if (!botState.myEntityId) {
        botState.myEntityId = computeEntityId(account.address);
        console.log("🆔 Bot Entity ID:", botState.myEntityId);
    }
    // Find our bot in the game state
    const myEntity = findMyEntity(lines, botState.myEntityId);
    if (myEntity) {
        // Bot is alive!
        if (!botState.isAlive) {
            console.log("✅ Bot is now ALIVE!");
            botState.isAlive = true;
        }
        botState.currentLine = myEntity.lineId;
        console.log(`🤖 Bot alive on line ${botState.currentLine}, mass: ${myEntity.mass}`);
        // Analyze the current situation and make a decision
        const decision = analyzeGameStateAndDecide(lines, myEntity, gameConfig, wadTime);
        // Execute decision if enough time has passed
        const timeSinceLastAction = wadTime - botState.lastActionTime;
        if (timeSinceLastAction >= botState.actionCooldown) {
            console.log(`🧠 DECISION: ${decision.reasoning}`);
            executeDecision(decision);
        }
        else {
            const waitTime = Number(botState.actionCooldown - timeSinceLastAction) / 1_000_000_000_000_000_000;
            console.log(`⏱️  Cooldown: ${waitTime.toFixed(1)}s remaining`);
        }
    }
    else {
        // Bot is dead or not spawned
        if (botState.isAlive) {
            console.log("💀 Bot died!");
            botState.isAlive = false;
            botState.consecutiveFailures = 0; // Reset on death
        }
        // Try to spawn if enough time has passed
        const timeSinceLastAction = wadTime - botState.lastActionTime;
        const spawnCooldown = 5000000000000000000n; // 5 seconds between spawn attempts
        if (timeSinceLastAction >= spawnCooldown) {
            console.log("🔄 Attempting to spawn...");
            attemptSpawn(lines);
        }
        else {
            const waitTime = Number(spawnCooldown - timeSinceLastAction) / 1_000_000_000_000_000_000;
            console.log(`⏳ Spawn cooldown: ${waitTime.toFixed(1)}s`);
        }
    }
    // Show game state info (like example bot)
    showGameStateInfo(lines, gameState);
}
// Find our bot entity in the game state
function findMyEntity(lines, myEntityId) {
    for (const line of lines) {
        if (!line)
            continue;
        const entity = line.find(e => e.entityId === myEntityId && e.etype === EntityType.ALIVE);
        if (entity)
            return entity;
    }
    return null;
}
// Analyze game state and make intelligent decisions
function analyzeGameStateAndDecide(lines, myEntity, gameConfig, wadTime) {
    const currentLine = myEntity.lineId;
    const myMass = myEntity.mass;
    // Strategy 1: EMERGENCY ESCAPE from dangerous edge lines
    if (currentLine <= 1) {
        return {
            action: 'jump',
            details: { up: false },
            reasoning: `EMERGENCY: Escaping dangerous top edge line ${currentLine}`
        };
    }
    if (currentLine >= 6) {
        return {
            action: 'jump',
            details: { up: true },
            reasoning: `EMERGENCY: Escaping dangerous bottom edge line ${currentLine}`
        };
    }
    // Strategy 2: Look for threats and opportunities on current line
    const currentLineEntities = lines[currentLine] || [];
    const threats = currentLineEntities.filter(e => e.etype === EntityType.ALIVE &&
        e.entityId !== myEntity.entityId &&
        e.mass > myMass);
    const food = currentLineEntities.filter(e => e.etype === EntityType.FOOD);
    const powerPellets = currentLineEntities.filter(e => e.etype === EntityType.POWER_PELLET);
    // Strategy 3: If there are threats, consider escaping vertically
    if (threats.length > 0) {
        const shouldEscape = Math.random() < 0.4; // 40% chance to escape
        if (shouldEscape) {
            const escapeUp = currentLine > 3; // Escape toward center
            return {
                action: 'jump',
                details: { up: escapeUp },
                reasoning: `THREAT DETECTED: ${threats.length} larger players, escaping ${escapeUp ? 'UP' : 'DOWN'}`
            };
        }
    }
    // Strategy 4: Hunt for power pellets if available
    if (powerPellets.length > 0) {
        const moveRight = Math.random() > 0.5;
        return {
            action: 'direction',
            details: { velRight: moveRight },
            reasoning: `POWER HUNT: Moving ${moveRight ? 'RIGHT' : 'LEFT'} toward ${powerPellets.length} power pellets`
        };
    }
    // Strategy 5: Collect food if safe
    if (food.length > 0 && threats.length === 0) {
        const moveRight = Math.random() > 0.5;
        return {
            action: 'direction',
            details: { velRight: moveRight },
            reasoning: `SAFE FEEDING: Moving ${moveRight ? 'RIGHT' : 'LEFT'} toward ${food.length} food items`
        };
    }
    // Strategy 6: Explore other lines for opportunities
    const shouldExplore = Math.random() < 0.3; // 30% chance to explore
    if (shouldExplore) {
        // Look for lines with more food/power pellets
        let bestLine = currentLine;
        let bestScore = (food.length * 2) + (powerPellets.length * 5);
        for (let lineId = 0; lineId < lines.length; lineId++) {
            if (lineId === currentLine || !lines[lineId])
                continue;
            const lineFood = lines[lineId].filter(e => e.etype === EntityType.FOOD).length;
            const linePellets = lines[lineId].filter(e => e.etype === EntityType.POWER_PELLET).length;
            const lineScore = (lineFood * 2) + (linePellets * 5);
            if (lineScore > bestScore) {
                bestScore = lineScore;
                bestLine = lineId;
            }
        }
        if (bestLine !== currentLine) {
            const jumpUp = bestLine < currentLine;
            return {
                action: 'jump',
                details: { up: jumpUp },
                reasoning: `EXPLORATION: Jumping ${jumpUp ? 'UP' : 'DOWN'} to line ${bestLine} (score: ${bestScore})`
            };
        }
    }
    // Strategy 7: Default safe movement
    const moveRight = Math.random() > 0.4; // Slight right bias
    return {
        action: 'direction',
        details: { velRight: moveRight },
        reasoning: `SAFE MOVEMENT: Moving ${moveRight ? 'RIGHT' : 'LEFT'} on line ${currentLine}`
    };
}
// Execute the decision
async function executeDecision(decision) {
    try {
        botState.lastActionTime = timeWad();
        switch (decision.action) {
            case 'direction':
                await executeDirectionChange(decision.details.velRight);
                botState.lastAction = `direction_${decision.details.velRight ? 'right' : 'left'}`;
                break;
            case 'jump':
                await executeJump(decision.details.up);
                botState.lastAction = `jump_${decision.details.up ? 'up' : 'down'}`;
                // Update estimated line position
                if (botState.isAlive) {
                    botState.currentLine = decision.details.up ?
                        Math.max(0, botState.currentLine - 1) :
                        Math.min(7, botState.currentLine + 1);
                }
                break;
        }
        // Success - reset failure counter and reduce cooldown
        botState.consecutiveFailures = 0;
        botState.actionCooldown = 1500000000000000000n; // 1.5s on success
    }
    catch (error) {
        console.error("❌ Decision execution failed:", error.message?.substring(0, 100) || 'Unknown error');
        // Handle death
        if (error.message?.includes('CALLER_IS_NOT_ALIVE') || error.message?.includes('caller is not alive')) {
            console.log("💀 Bot died during action!");
            botState.isAlive = false;
        }
        // Increase cooldown on failure
        botState.consecutiveFailures++;
        const maxCooldown = 5000000000000000000n; // Max 5 seconds
        const additionalCooldown = BigInt(botState.consecutiveFailures) * 500000000000000000n;
        const newCooldown = botState.actionCooldown + additionalCooldown;
        botState.actionCooldown = newCooldown > maxCooldown ? maxCooldown : newCooldown;
    }
}
// Attempt to spawn the bot
async function attemptSpawn(lines) {
    try {
        // Choose spawn line - prefer lines 2,4 (corners) but analyze safety
        const cornerLines = [2, 4];
        let bestLine = cornerLines[Math.floor(Math.random() * cornerLines.length)];
        // Quick safety check - avoid lines with many players
        for (const lineId of cornerLines) {
            const lineEntities = lines[lineId] || [];
            const alivePlayers = lineEntities.filter(e => e.etype === EntityType.ALIVE).length;
            if (alivePlayers < 3) { // Less crowded
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
    }
    catch (error) {
        if (error.message?.includes('CALLER_IS_ALIVE')) {
            console.log("🎉 Bot is already alive!");
            botState.isAlive = true;
        }
        else if (error.message?.includes('NO_ACCESS')) {
            console.error("❌ Authentication required! Please complete X/Twitter linking first");
            // Longer cooldown for auth issues
            botState.actionCooldown = 30000000000000000000n; // 30 seconds
        }
        else {
            console.error("❌ Spawn failed:", error.message?.substring(0, 100) || 'Unknown error');
        }
    }
}
// Execute direction change
async function executeDirectionChange(velRight) {
    const hash = await walletClient.writeContract({
        address: WORLD_ADDRESS,
        abi: DIRECTION_ABI,
        functionName: "setDirection",
        args: [velRight],
        chain,
        account,
    });
    console.log(`✅ Direction changed to ${velRight ? 'RIGHT' : 'LEFT'}:`, hash);
}
// Execute jump
async function executeJump(up) {
    const hash = await walletClient.writeContract({
        address: WORLD_ADDRESS,
        abi: JUMP_ABI,
        functionName: "jumpToLine",
        args: [up],
        chain,
        account,
    });
    console.log(`✅ Jumped ${up ? 'UP' : 'DOWN'}:`, hash);
}
// Show game state info (like example bot)
function showGameStateInfo(lines, gameState) {
    lines.forEach((line, idx) => {
        if (!line)
            return;
        const players = line
            .filter(entity => entity.etype === EntityType.ALIVE && gameState.usernames.has(entity.entityId))
            .map(entity => gameState.usernames.get(entity.entityId));
        const food = line.filter(e => e.etype === EntityType.FOOD).length;
        const pellets = line.filter(e => e.etype === EntityType.POWER_PELLET).length;
        if (players.length > 0 || food > 0 || pellets > 0) {
            console.log(`Line ${idx}: ${players.length > 0 ? players.join(", ") : "No players"} | Food: ${food} | Pellets: ${pellets}`);
        }
    });
}
// MAIN FUNCTION - Uses MUD sync system like example bot
export async function main() {
    console.log("🤖 Smart RethMatch Bot Starting...");
    console.log("📡 World Address:", WORLD_ADDRESS);
    console.log("🎮 Bot Address:", account.address);
    console.log("🔗 Chain:", chain.name);
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    // Use MUD sync system (exactly like example bot)
    const { storedBlockLogs$ } = await syncToStash({
        stash: stash,
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
    // Subscribe to block updates (exactly like example bot)
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
            console.log("\n📥 Got block:", Number(syncProgress.latestBlockNumber));
            // CALL OUR BOT LOGIC HERE - with real game state!
            onBlock(liveState, data.gameConfig, timeWad());
        }
        else {
            if (syncProgress.step === "snapshot")
                progressBar.update(0);
            else
                progressBar.update(Math.round(syncProgress.percentage));
        }
    });
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log("\n\n🛑 Shutting down bot...");
        process.exit(0);
    });
}
console.log("🚀 Starting Smart RethMatch Bot with MUD Sync...");
console.log("💡 Features: Real-time game state analysis, intelligent decisions, block-based actions");
console.log();
main().catch(console.error);
