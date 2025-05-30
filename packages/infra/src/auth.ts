import "dotenv/config";
import express from "express";
import { clerkClient, requireAuth, getAuth, clerkMiddleware } from "@clerk/express";
import cors from "cors";
import bodyParser from "body-parser";
import { privateKeyToAccount, sign } from "viem/accounts";
import { encodePacked, getAddress, keccak256 } from "viem";

const signingPrivateKey = process.env.SIGNING_PRIVATE_KEY as `0x${string}`;
if (!signingPrivateKey) {
  throw new Error("SIGNING_PRIVATE_KEY is not set");
}

const signingAccount = privateKeyToAccount(signingPrivateKey);

console.log("Using signing account:", signingAccount.address);

const app = express();
const PORT = 3002;

app.use(cors());
app.use(bodyParser.json({ limit: "1mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(clerkMiddleware());

app.post("/generateAccessSignature", requireAuth(), async (req, res) => {
  if (!req.body) {
    res.status(400).json({ message: "Request body is required" });
    return;
  }

  const address = req.body.address;
  if (!address) {
    res.status(400).json({ message: "Address is required" });
    return;
  }

  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ message: "Invalid request, please sign in" });
    return;
  }

  const clerkUser = await clerkClient.users.getUser(userId);
  if (!clerkUser) {
    res.status(401).json({ message: "User does not exist." });
    return;
  }
  if (!clerkUser.username) {
    res.status(401).json({ message: "User does not have a username." });
    return;
  }

  const accessSignature = await sign({
    hash: keccak256(encodePacked(["address", "string"], [getAddress(address), clerkUser.username])),
    privateKey: signingPrivateKey,
    to: "hex",
  });

  // Link the address to the user in Clerk for convenience.
  await clerkClient.users.updateUserMetadata(userId, { publicMetadata: { address } });

  res.json({ accessSignature: accessSignature });
});

app.get("/", async (req, res) => {
  res.status(401).json({
    message: "Unauthorized, please sign in",
  });
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
  console.log(`Auth listening at http://localhost:${PORT}`);
});
