"use strict";

const { connectDB, disconnectDB } = require("../src/config/db");
const Cart = require("../src/modules/cart/cart.model");

async function syncCartIndexes() {
  await connectDB();

  const indexes = await Cart.collection.indexes();
  const userIndex = indexes.find((index) => index.name === "user_1");
  const hasPartialUserIndex =
    userIndex?.unique &&
    userIndex.partialFilterExpression?.user?.$type === "objectId";

  if (userIndex && !hasPartialUserIndex) {
    if (!userIndex.unique || userIndex.partialFilterExpression) {
      throw new Error(
        "Unexpected Cart user_1 index; refusing to replace an unknown index.",
      );
    }

    await Cart.collection.dropIndex("user_1");
  }

  if (!hasPartialUserIndex) {
    await Cart.collection.createIndex(
      { user: 1 },
      {
        name: "user_1",
        unique: true,
        partialFilterExpression: { user: { $type: "objectId" } },
      },
    );
  }

  const sessionIndex = indexes.find((index) => index.name === "sessionId_1");
  const hasSessionIndex =
    sessionIndex?.key?.sessionId === 1 &&
    sessionIndex.partialFilterExpression?.sessionId?.$type === "string";
  if (sessionIndex && !hasSessionIndex) {
    throw new Error("Unexpected Cart sessionId_1 index; refusing to replace an unknown index.");
  }
  if (!hasSessionIndex) {
    await Cart.collection.createIndex(
      { sessionId: 1 },
      {
        name: "sessionId_1",
        partialFilterExpression: { sessionId: { $type: "string" } },
      },
    );
  }

  const ttlIndex = indexes.find((index) => index.name === "guest_cart_ttl_1");
  const hasGuestTtlIndex =
    ttlIndex?.key?.updatedAt === 1 &&
    ttlIndex.expireAfterSeconds === 30 * 24 * 60 * 60 &&
    ttlIndex.partialFilterExpression?.user === null;
  if (ttlIndex && !hasGuestTtlIndex) {
    throw new Error("Unexpected Cart guest_cart_ttl_1 index; refusing to replace an unknown index.");
  }
  if (!hasGuestTtlIndex) {
    await Cart.collection.createIndex(
      { updatedAt: 1 },
      {
        name: "guest_cart_ttl_1",
        expireAfterSeconds: 30 * 24 * 60 * 60,
        partialFilterExpression: { user: null },
      },
    );
  }
}

syncCartIndexes()
  .then(() => {
    console.log("Cart ownership and guest session indexes synchronized.");
  })
  .catch((error) => {
    console.error("Failed to synchronize Cart ownership index:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
