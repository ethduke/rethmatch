# Sleep for 10 seconds for logging purposes.
sleep 10

# Default to Odyssey.
CHAIN_ID=${CHAIN_ID:-911867}
CHAIN_URL=${CHAIN_URL:-odyssey.ithaca.xyz}

# Extract address and blockNumber from worlds.json.
STORE_ADDRESS=$(jq -r ".[\"$CHAIN_ID\"][\"address\"]" ../contracts/worlds.json)
START_BLOCK=$(jq -r ".[\"$CHAIN_ID\"][\"blockNumber\"]" ../contracts/worlds.json)

if [ -z "$STORE_ADDRESS" ] || [ -z "$START_BLOCK" ]; then
  echo "Error: STORE_ADDRESS or START_BLOCK are unset."
  exit 1
fi

echo "Starting store indexer for chain $CHAIN_ID with params:"
echo "STORE_ADDRESS: $STORE_ADDRESS"
echo "START_BLOCK: $START_BLOCK"
echo ""

# Options: https://mud.dev/indexer/sqlite
RPC_HTTP_URL="https://$CHAIN_URL" \
RPC_WS_URL="wss://$CHAIN_URL" \
STORE_ADDRESS="$STORE_ADDRESS" \
START_BLOCK="$START_BLOCK" \
MAX_BLOCK_RANGE=500 \
PORT=3001 \
npx -y -p @latticexyz/store-indexer sqlite-indexer