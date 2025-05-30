import { Entity, isLeftmostEntity, isRightmostEntity } from "./game/entityLib";

export const [DEBUG_ITER, DEBUG_LINE, DEBUG_PERF, DEBUG_GAS, DEBUG_EMOJI, DEBUG_VERBOSE] = [
  getDebugParam("debug_iter"),
  getDebugParam("debug_line"),
  getDebugParam("debug_perf"),
  getDebugParam("debug_gas"),
  getDebugParam("debug_emoji"),
  getDebugParam("debug_verbose"),
]; // For debugging.

if (DEBUG_ITER != null && DEBUG_LINE == null)
  alert("DEBUG_LINE should almost certainly be set if using DEBUG_ITER");

export function getDebugParam(param: string): number | null {
  const value =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get(param) : null;
  return value !== null ? Number(value) : null;
}

const colorfulEmojis = [
  "🕋", // Kaaba (Black)
  "🐸", // Frog (Green)
  "🍅", // Tomato (Red)
  "🍊", // Tangerine (Orange)
  "🍋", // Lemon (Yellow)
  "🍇", // Grapes (Purple)
  "🌸", // Cherry Blossom (Pink)
  "🌻", // Sunflower (Yellow)
  "🌼", // Blossom (Light Yellow)
  "🌿", // Herb (Green)
  "🔥", // Fire (Red/Orange)
  "💧", // Droplet (Blue)
  "🌍", // Globe Showing Europe-Africa (Green/Blue)
  "🌙", // Crescent Moon (Yellow)
  "⭐", // Star (Yellow)
  "🍁", // Maple Leaf (Red)
  "🍀", // Four Leaf Clover (Green)
  "🌈", // Rainbow
  "🌊", // Water Wave (Blue)
  "🌌", // Milky Way (Space Colors)
  "🎈", // Balloon (Red)
  "💎", // Gem Stone (Blue)
  "🍑", // Peach (Orange)
  "🍒", // Cherries (Red)
  "🍓", // Strawberry (Red)
  "🌹", // Rose (Red)
  "🥑", // Avocado (Green)
  "🥥", // Coconut (Brown)
  "🫐", // Blueberries (Blue)
  "🌺", // Hibiscus (Red)
  "🥕", // Carrot (Orange)
  "🌽", // Corn (Yellow)
  "🍆", // Eggplant (Purple)
  "🌶️", // Hot Pepper (Red)
  "🥒", // Cucumber (Green)
  "🍄", // Mushroom (Red/White)
  "🌰", // Chestnut (Brown)
  "🍯", // Honey Pot (Yellow)
  "🦋", // Butterfly (Blue)
  "🐠", // Tropical Fish (Orange/Blue)
  "🦜", // Parrot (Red/Green/Yellow)
  "🐙", // Octopus (Purple)
  "🦚", // Peacock (Green/Blue)
  "🌖", // Waning Gibbous Moon (Yellow)
  "❄️", // Snowflake (Blue/White)
  "🔮", // Crystal Ball (Purple)
  "🎃", // Jack-o-lantern (Orange)
  "🌟", // Glowing Star (Yellow)
  "🌠", // Shooting Star (Yellow)
  "🌋", // Volcano (Red/Orange)
  "🏜️", // Desert (Yellow/Brown)
  "🏝️", // Desert Island (Green/Blue)
  "🌅", // Sunrise (Yellow/Blue)
  "🌄", // Mountain at Sunrise (Orange/Blue)
  "🏞️", // National Park (Green)
  "🌐", // Globe with Meridians (Blue/Green)
  "🧊", // Ice (Light Blue/White)
  "🛸", // Flying Saucer (Grey)
  "🎍", // Pine Decoration (Green)
  "🎋", // Tanabata Tree (Green)
  "🧨", // Firecracker (Red)
  "🎏", // Carp Streamer (Red/Blue)
  "🏮", // Red Paper Lantern
  "🎴", // Flower Playing Cards (Red/Blue),
  "🥮", // Moon Cake (Yellow)
  "🥭", // Mango (Yellow/Orange)
  "🍍", // Pineapple (Yellow)
  "🥖", // Baguette Bread (Brown)
  "🥨", // Pretzel (Brown)
  "🍩", // Doughnut (Brown/Pink)
  "🍪", // Cookie (Brown)
  "⛩️", // Shinto Shrine (Red)
  "🚌", // Bus (Yellow)
  "🛶", // Canoe (Brown)
  "🛎️", // Bellhop Bell (Gold)
  "🍟", // French Fries (Yellow)
  "🥣", // Bowl with Spoon (White)
  "🧁", // Cupcake (Pink/White)
  "🍭", // Lollipop (Rainbow)
  "🍬", // Candy (Colorful)
  "🦖", // T-Rex (Green)
  "🍫", // Chocolate Bar (Brown)
  "🦄", // Unicorn (White/Pink)
  "🐲", // Dragon Face (Green)
  "🎳", // Bowling (White/Red)
  "🗽", // Statue of Liberty (Green)
  "🎟️", // Admission Tickets (Red)
  "🎬", // Clapper Board (Black/White)
  "🎨", // Artist Palette (Colorful)
  "🧶", // Yarn (Blue)
  "🧵", // Thread (Red)
  "🪡", // Sewing Needle (Silver)
  "🧩", // Puzzle Piece (Blue)
  "🎯", // Bullseye (Red/White)
  "🎱", // Pool 8 Ball (Black/White)
  "🚧", // Construction (Yellow/Black)
  "⚓", // Anchor (Black)
  "⛵", // Sailboat (White)
  "📟", // Pager (Grey)
  "📚", // Books (Colorful)
  "🎙️", // Studio Microphone (Grey)
  "💽", // Computer Disk (Black)
  "🎽", // Running Shirt (Blue)
];

export function mapEntityToEmoji(entity: bigint) {
  if (entity == 0n) return "N/A";

  if (isLeftmostEntity(entity)) return "[LEFT_BOUNDARY]";
  if (isRightmostEntity(entity)) return "[RIGHT_BOUNDARY]";

  return colorfulEmojis[Number(entity % BigInt(colorfulEmojis.length))];
}

export function findOrThrow(line: Entity[], entityId: bigint): Entity {
  const entity = line.find((e) => e.entityId === entityId);
  if (!entity) {
    console.trace("findOrThrow: Entity not found!");
    throw new Error("ENTITY_NOT_FOUND");
  }
  return entity;
}
