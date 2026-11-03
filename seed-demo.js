'use strict';
require('dotenv').config();
const mongoose = require('mongoose');

const BASE = 'https://wear-store.vercel.app/assets';

const products = [
  { name: 'Classic Tailored Blazer', price: 189.99, regular: 249.99, img: 'product-1-KaY4E-Vr.jpg', colors: [{n:'Sand',c:'#d4b896'},{n:'Black',c:'#1a1a1a'},{n:'Ivory',c:'#f5f0e8'}], rating: 4.8, reviews: 124, featured: true, newArrival: false, bestSeller: false, desc: 'A timeless tailored blazer crafted from premium wool-blend fabric.' },
  { name: 'Terracotta Flow Dress', price: 142.00, regular: 195.00, img: 'product-2-CDCYJr4d.jpg', colors: [{n:'Terracotta',c:'#c85a2f'},{n:'Sage',c:'#8a9a7e'},{n:'Dusty Rose',c:'#c9928c'}], rating: 4.9, reviews: 87, featured: true, newArrival: false, bestSeller: true, desc: 'Flowing midi dress in breathable terracotta fabric.' },
  { name: 'Slim Fit Tailored Trousers', price: 98.00, regular: 98.00, img: 'product-3-CFapsEVI.jpg', colors: [{n:'Charcoal',c:'#36454f'},{n:'Navy',c:'#1a237e'},{n:'Beige',c:'#d6c6a8'}], rating: 4.6, reviews: 54, featured: false, newArrival: true, bestSeller: false, desc: 'Sharp slim-fit trousers with a modern cut.' },
  { name: 'Oversized Knit Sweater', price: 115.00, regular: 115.00, img: 'product-4-BoETHOXy.jpg', colors: [{n:'Cream',c:'#f5f0e8'},{n:'Grey',c:'#808080'},{n:'Rust',c:'#b7410e'}], rating: 4.7, reviews: 63, featured: false, newArrival: true, bestSeller: false, desc: 'Cozy oversized knit sweater for chilly days.' },
  { name: 'Wide-Leg Jumpsuit', price: 155.00, regular: 155.00, img: 'product-5-DclPXWhn.jpg', colors: [{n:'Black',c:'#1a1a1a'},{n:'Olive',c:'#556b2f'},{n:'Sand',c:'#d4b896'}], rating: 4.5, reviews: 41, featured: false, newArrival: false, bestSeller: false, desc: 'Effortless wide-leg jumpsuit for any occasion.' },
  { name: 'Linen Button-Down Shirt', price: 79.00, regular: 79.00, img: 'product-6-BJbAfWtg.jpg', colors: [{n:'White',c:'#ffffff'},{n:'Sky Blue',c:'#87ceeb'},{n:'Sage',c:'#8a9a7e'}], rating: 4.6, reviews: 92, featured: true, newArrival: true, bestSeller: false, desc: 'Breathable linen shirt for warm weather.' },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  console.log('connected');

  const now = new Date();

  const catNames = ['Women', 'Men', 'Unisex'];
  const cats = {};
  for (const n of catNames) {
    let c = await db.collection('categories').findOne({ name: n });
    if (!c) {
      const r = await db.collection('categories').insertOne({ name: n, slug: n.toLowerCase(), isActive: true, sortOrder: 0, createdAt: now, updatedAt: now });
      c = { _id: r.insertedId, name: n };
    }
    cats[n] = c;
  }

  let brand = await db.collection('brands').findOne({ name: "Bushu's Wear" });
  if (!brand) {
    const r = await db.collection('brands').insertOne({ name: "Bushu's Wear", slug: 'bushus-wear', isActive: true, createdAt: now, updatedAt: now });
    brand = { _id: r.insertedId, name: "Bushu's Wear" };
  }

  const sizes = ['XS','S','M','L','XL'];

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const existing = await db.collection('products').findOne({ name: p.name });
    if (existing) {
      await db.collection('productvariants').deleteMany({ product: existing._id });
      await db.collection('products').deleteOne({ _id: existing._id });
    }
    const cat = cats[i % 2 === 0 ? 'Women' : 'Men'];
    const slug = p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const prodSku = p.name.toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + (i+1);
    const prodRes = await db.collection('products').insertOne({
      name: p.name,
      sku: prodSku,
      slug,
      description: p.desc,
      shortDescription: p.desc,
      category: cat._id,
      brand: brand._id,
      images: [{ _id: new mongoose.Types.ObjectId(), url: `${BASE}/${p.img}`, publicId: p.img, isMain: true }],
      tags: ['new'],
      isFeatured: p.featured,
      isNewArrival: p.newArrival,
      isBestSeller: p.bestSeller,
      isActive: true,
      isDeleted: false,
      status: 'active',
      basePrice: p.price,
      averageRating: p.rating,
      totalReviews: p.reviews,
      totalSold: Math.floor(Math.random()*200),
      createdAt: now,
      updatedAt: now,
    });
    const prodId = prodRes.insertedId;

    let skuCounter = 0;
    for (const col of p.colors) {
      for (const sz of sizes) {
        skuCounter++;
        const sku = `${p.name.replace(/\s/g,'').slice(0,6).toUpperCase()}-${col.n.slice(0,3).toUpperCase()}-${sz}-${skuCounter}`.replace(/[^A-Z0-9-]/g,'');
        await db.collection('productvariants').insertOne({
          product: prodId,
          size: sz,
          color: col.n,
          colorCode: col.c,
          sku,
          price: p.price,
          regularPrice: p.regular,
          stock: 10 + Math.floor(Math.random()*20),
          isActive: true,
          images: [],
          weight: 0,
          lowStockThreshold: 5,
          costPrice: 0,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    console.log('seeded', p.name);
  }

  console.log('DONE');
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });