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
}

syncCartIndexes()
  .then(() => {
    console.log("Cart ownership index synchronized.");
  })
  .catch((error) => {
    console.error("Failed to synchronize Cart ownership index:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
