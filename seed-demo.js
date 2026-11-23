'use strict';

require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data when NODE_ENV=production.');
  process.exitCode = 1;
} else {
  main().catch((error) => {
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
  }).finally(async () => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');

  const mongoose = require('mongoose');
  const slugify = require('slugify');
  const Category = require('./src/modules/category/category.model');
  const Brand = require('./src/modules/brand/brand.model');
  const Product = require('./src/modules/product/product.model');
  const ProductVariant = require('./src/modules/variant/variant.model');

  await mongoose.connect(process.env.MONGODB_URI);
  const imageUrl = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80&crop=entropy`;
  const products = [
    { name: 'Classic Tailored Blazer', price: 1899, regular: 2499, img: 'photo-1591047139829-d91aecb6caea', colors: [['Sand', '#d4b896'], ['Black', '#1a1a1a'], ['Ivory', '#f5f0e8']], rating: 4.8, reviews: 124, featured: true, newArrival: false, bestSeller: false, desc: 'A timeless tailored blazer crafted from premium wool-blend fabric.' },
    { name: 'Terracotta Flow Dress', price: 1420, regular: 1950, img: 'photo-1595777457583-95e059d581b8', colors: [['Terracotta', '#c85a2f'], ['Sage', '#8a9a7e'], ['Dusty Rose', '#c9928c']], rating: 4.9, reviews: 87, featured: true, newArrival: false, bestSeller: true, desc: 'Flowing midi dress in breathable terracotta fabric.' },
    { name: 'Slim Fit Tailored Trousers', price: 980, regular: 980, img: 'photo-1594633312681-425c7b97ccd1', colors: [['Charcoal', '#36454f'], ['Navy', '#1a237e'], ['Beige', '#d6c6a8']], rating: 4.6, reviews: 54, featured: false, newArrival: true, bestSeller: false, desc: 'Sharp slim-fit trousers with a modern cut.' },
    { name: 'Oversized Knit Sweater', price: 1150, regular: 1150, img: 'photo-1576566588028-4147f3842f27', colors: [['Cream', '#f5f0e8'], ['Grey', '#808080'], ['Rust', '#b7410e']], rating: 4.7, reviews: 63, featured: false, newArrival: true, bestSeller: false, desc: 'Cozy oversized knit sweater for chilly days.' },
    { name: 'Wide-Leg Jumpsuit', price: 1550, regular: 1550, img: 'photo-1544022613-e87ca75a784a', colors: [['Black', '#1a1a1a'], ['Olive', '#556b2f'], ['Sand', '#d4b896']], rating: 4.5, reviews: 41, featured: false, newArrival: false, bestSeller: false, desc: 'Effortless wide-leg jumpsuit for any occasion.' },
    { name: 'Linen Button-Down Shirt', price: 790, regular: 790, img: 'photo-1602810318383-e386cc2a3ccf', colors: [['White', '#ffffff'], ['Sky Blue', '#87ceeb'], ['Sage', '#8a9a7e']], rating: 4.6, reviews: 92, featured: true, newArrival: true, bestSeller: false, desc: 'Breathable linen shirt for warm weather.' },
  ];

  const categories = {};
  for (const [index, name] of ['Women', 'Men', 'Unisex'].entries()) {
    categories[name] = await Category.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, slug: slugify(name, { lower: true, strict: true }), isActive: true, sortOrder: index } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }
  const brand = await Brand.findOneAndUpdate(
    { name: 'BERA FASHION' },
    { $setOnInsert: { name: 'BERA FASHION', slug: 'bera-fashion', isActive: true } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  const sizes = ['XS', 'S', 'M', 'L', 'XL'];
  for (const [index, item] of products.entries()) {
    const skuBase = `${slugify(item.name, { lower: true, strict: true }).toUpperCase()}-${index + 1}`;
    const product = await Product.findOneAndUpdate(
      { sku: skuBase },
      { $setOnInsert: {
        name: item.name,
        sku: skuBase,
        slug: slugify(item.name, { lower: true, strict: true }),
        description: item.desc,
        shortDescription: item.desc,
        category: categories[index % 2 === 0 ? 'Women' : 'Men']._id,
        brand: brand._id,
        images: [{ url: imageUrl(item.img), publicId: `demo/${item.img}`, isMain: true }],
        tags: ['new'],
        isFeatured: item.featured,
        isNewArrival: item.newArrival,
        isBestSeller: item.bestSeller,
        isActive: true,
        isDeleted: false,
        status: 'active',
        basePrice: item.price,
        averageRating: item.rating,
        totalReviews: item.reviews,
        totalSold: 0,
      } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );

    let counter = 0;
    for (const [color, colorCode] of item.colors) {
      for (const size of sizes) {
        counter += 1;
        const sku = `${skuBase.slice(0, 12)}-${color.slice(0, 3).toUpperCase()}-${size}-${counter}`.replace(/[^A-Z0-9-]/g, '');
        await ProductVariant.findOneAndUpdate(
          { sku },
          { $setOnInsert: {
            product: product._id,
            size,
            color,
            colorCode,
            sku,
            price: item.price,
            regularPrice: item.regular,
            stock: 20,
            isActive: true,
            images: [],
            weight: 0,
            lowStockThreshold: 5,
            costPrice: 0,
          } },
          { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
        );
      }
    }
    console.log(`Seeded ${item.name}`);
  }
  console.log('Demo seed complete. Existing records were preserved.');
}
