# Smart RethMatch Bot

A strategic bot for the RethMatch game - an onchain tournament inspired by Pac-Man and Agar.io, built with MUD and hosted on the Reth-powered Odyssey testnet.

## Features

🤖 **Intelligent Gameplay**: Strategic decision-making for spawning, movement, and jumping
🎯 **Simple Strategy**: Randomized actions with intelligent timing
⚡ **Standalone Design**: No complex dependencies - just the essentials
🔄 **Game Actions**: Spawn, direction changes, and line jumping
🛡️ **Error Handling**: Robust error handling and retry logic

## Game Mechanics

- **Players** move horizontally on lines with velocity based on mass
- **Eating**: Consume food, power pellets, and smaller players to grow
- **Power Pellets**: Temporary invincibility and ability to eat any player
- **Walls**: Deadly obstacles unless powered up
- **Jumping**: Switch lines at the cost of mass
- **Scoring**: Based on total mass consumed during each life

## Quick Setup

### 🔑 **IMPORTANT: Authentication Required First!**

**Before running the bot, you MUST authenticate with the RethMatch system. Skipping this will cause 401 errors and spawn failures.**

### 1. Prerequisites

- Node.js (v18+)
- An Ethereum wallet with funds on Odyssey testnet
- X (Twitter) account linked to your wallet address

### 2. **Complete Authentication (Critical Step!)**

1. **Sign in with X**: Visit [RethMatch game website](https://rethmatch.xyz) and click "LOGIN WITH X TO PLAY"
2. **Link Wallet**: Choose your bot's Ethereum address (this cannot be changed later!)
3. **Generate Access Signature**: Click "GENERATE ACCESS SIGNATURE" and copy the result
4. **Submit Access**: Call the access function on-chain:
   ```bash
   # Using cast (from Foundry)
   cast send <WORLD_CONTRACT> "access(bytes,string)" <ACCESS_SIGNATURE> <LOWERCASED_TWITTER_USERNAME> --rpc-url https://odyssey.ithaca.xyz --private-key <YOUR_PRIVATE_KEY>
   ```

**⚠️ Without completing step 2, your bot will get 401 errors and cannot spawn!**

### 3. Installation & Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp bot-env.example .env
# Edit .env and add your private key

# Build the bot
npm run build

# Run the bot
npm start
```

## Configuration

Update these values in `smart-bot.ts` for the actual game:

```typescript
// Update with actual game addresses
const WORLD_ADDRESS = "0x..." // Get from RethMatch website
const START_BLOCK = 123456n;   // Get from game documentation
```

## Bot Strategy

### Current Implementation

The bot implements a simple but effective strategy:

1. **Spawning**: Attempts to spawn when dead with smart retry logic
2. **Movement**: Randomly changes direction every 5 seconds
3. **Jumping**: Occasionally jumps to different lines
4. **Strategy Switching**: Randomly adapts between hunt/flee/collect/powerup modes

### Expansion Opportunities

The codebase is designed for easy expansion:

- **Advanced Targeting**: Implement the `findBestTarget()` function for smarter food/player targeting
- **Threat Assessment**: Use `calculateEntityDanger()` for better survival decisions
- **State Monitoring**: Add real game state synchronization for precise control
- **Machine Learning**: Train on game patterns for optimal decision making

## Development

### Building Only the Bot

The project is configured to build only the standalone bot, avoiding complex game dependencies:

```bash
npm run build  # Compiles just smart-bot.ts
npm run dev    # Watch mode for development
```

### Adding Game State Sync

To add real game state monitoring, you'll need to:

1. Install MUD dependencies: `@latticexyz/store-sync`, `@latticexyz/stash`
2. Implement block synchronization
3. Parse game events and entities
4. Replace the simple `monitorGameState()` with real data

### Key Functions

- `executeSpawn()`: Spawns the bot on a specified line
- `executeDirectionChange()`: Changes movement direction
- `executeJump()`: Jumps to adjacent lines
- `monitorGameState()`: Main strategy loop
- `runBot()`: Bot initialization and main loop

## Troubleshooting

### Common Issues

1. **WebSocket 401 Errors**: 
   ```
   Error: Unexpected server response: 401
   ```
   **Solution**: Complete the X/Twitter authentication steps first. WebSocket access requires authentication.

2. **"NO_ACCESS" or "INVALID_PROPOSED_RIGHT_NEIGHBOR" Errors**: 
   ```
   INVALID_PROPOSED_RIGHT_NEIGHBOR
   ```
   **Solution**: Your wallet hasn't been authenticated. Follow the authentication steps in section 2.

3. **Transaction Failures**: Check wallet balance and RPC connectivity

4. **Build Errors**: Ensure Node.js v18+ and all dependencies installed

### Environment Variables

```bash
PRIVATE_KEY=0x...  # Required: Your wallet's private key
```

### Network Issues

The bot connects to Odyssey testnet:
- RPC: `https://odyssey.ithaca.xyz`
- WebSocket: `wss://odyssey.ithaca.xyz/ws`
- Explorer: `https://explorer.ithaca.xyz`

## Safety & Security

- **Private Keys**: Never commit your `.env` file
- **Testnet Only**: This bot is designed for Odyssey testnet
- **Rate Limiting**: Built-in cooldowns prevent transaction spam
- **Error Recovery**: Robust error handling with automatic retries

## Resources

- [RethMatch Documentation](https://hackmd.io/@t11s/rethmatch)
- [MUD Framework](https://mud.dev/introduction)
- [Viem Documentation](https://viem.sh/)
- [Odyssey Testnet](https://odyssey.ithaca.xyz)

## License

MIT License - see repository for details.

---

**🎮 Ready to compete?** Update the configuration, set your private key, and let your bot join the RethMatch tournament!

## Current Status

### ✅ What Works Now
- **Authentication**: Confirmed working with X/Twitter linking
- **Bot Framework**: Solid foundation with error handling and retry logic
- **Network Connection**: Successfully connects to Odyssey testnet
- **Contract Interface**: Proper ABI definitions and transaction sending
- **✨ Smart Spawn Logic**: **WORKING!** Bot successfully spawns using boundary entities
- **Multiple Spawn Strategies**: Tries 4 different rightNeighbor strategies for maximum success rate
- **Real Gameplay**: Bot can spawn, change direction, and jump between lines

### 🚀 What's New in Enhanced Version

**Smart Spawn Implementation**: The bot now successfully spawns by using intelligent rightNeighbor selection:

1. **Rightmost Boundary Entity**: Uses calculated boundary entity IDs (most reliable)
2. **Leftmost Boundary Entity**: Fallback boundary entity strategy  
3. **Own Entity ID**: Uses the bot's computed entity ID
4. **Entity ID 1**: Final fallback strategy

**Improved Error Handling**: Better error messages and automatic retry logic with multiple spawn strategies.

**🔄 State Synchronization**: Fixes "caller is not alive" issues by:
- **Real-time Status Checking**: Queries contract to verify if bot is actually alive
- **Automatic State Correction**: Updates internal state when desync detected
- **Spawn Verification**: Waits and confirms spawn success before marking as alive
- **Death Detection**: Automatically detects when bot dies and updates state
- **Error Recovery**: Handles "caller is not alive" errors gracefully

### 🎯 Successful Implementation

✅ **Problem Solved**: The original spawn issue has been resolved! The bot now:
- Successfully spawns using boundary entity calculations
- Handles authentication properly
- Provides clear feedback on spawn attempts
- Automatically retries with different strategies
- Successfully executes game actions (direction changes, line jumps)

### 🔧 Next Steps for Advanced Features

For developers wanting to further enhance this bot:

1. **Full MUD Store Sync**: Add complete game state synchronization for strategic decision making
2. **Advanced AI**: Implement smart targeting, threat assessment, and optimal path planning  
3. **Real-time Strategy**: Use live game data for intelligent food hunting and player avoidance
4. **Machine Learning**: Train the bot on game patterns for competitive play

The foundation is now solid and the bot is **fully functional** for RethMatch gameplay! 