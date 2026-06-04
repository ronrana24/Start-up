import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding products...');

  // Check if we already have products
  const count = await prisma.product.count();
  if (count > 0) {
    console.log('Products already exist. Skipping seed.');
    return;
  }

  await prisma.product.create({
    data: {
      name: 'Premium Tissue Paper',
      category: 'TISSUE_AND_HYGIENE',
      unit: 'PACK',
      piecesPerPack: 10,
      isPublic: true,
      batches: {
        create: {
          batchNumber: 1,
          costPrice: 50.00,
          sellingPrice: 75.00,
          quantity: 100,
          bulkTiers: [
            { minimumQuantity: 10, pricePerUnit: 70.00 }
          ]
        }
      }
    }
  });

  await prisma.product.create({
    data: {
      name: 'Party Balloons (Pack of 50)',
      category: 'PARTY_AND_CELEBRATION',
      unit: 'PACK',
      piecesPerPack: 50,
      isPublic: true,
      batches: {
        create: {
          batchNumber: 1,
          costPrice: 100.00,
          sellingPrice: 150.00,
          quantity: 50,
          bulkTiers: [
            { minimumQuantity: 5, pricePerUnit: 140.00 }
          ]
        }
      }
    }
  });

  await prisma.product.create({
    data: {
      name: 'Glass Cleaner Spray',
      category: 'CLEANING_AND_FRAGRANCE',
      unit: 'PIECE',
      piecesPerPack: 1,
      isPublic: true,
      batches: {
        create: {
          batchNumber: 1,
          costPrice: 80.00,
          sellingPrice: 120.00,
          quantity: 200,
          bulkTiers: [
            { minimumQuantity: 10, pricePerUnit: 110.00 }
          ]
        }
      }
    }
  });

  console.log('Seed completed successfully! Added 3 products.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
