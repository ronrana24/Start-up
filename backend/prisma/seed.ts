import {
  PrismaClient,
  ProductCategory,
  ProductUnit,
  RiderStatus,
  UserRole,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.orderItemBatchAllocation.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventoryBatch.deleteMany();
  await prisma.product.deleteMany();
  await prisma.address.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.rider.deleteMany();
  await prisma.user.deleteMany();

  await prisma.user.create({
    data: {
      phone: '+919876543210',
      businessName: 'Platform Admin',
      role: UserRole.ADMIN,
    },
  });

  const buyer = await prisma.user.create({
    data: {
      phone: '+919999999999',
      businessName: 'Acme Wholesale Pvt Ltd',
      role: UserRole.BUYER,
    },
  });

  await prisma.address.create({
    data: {
      userId: buyer.id,
      line1: 'Plot 12, Phase 2 Industrial Area',
      line2: 'Near NH44',
      city: 'Bengaluru',
      state: 'KA',
      pincode: '560001',
      latitude: 12.9716,
      longitude: 77.5946,
      locationSource: 'seed',
      isDefault: true,
    },
  });

  const productsData: Array<{
    name: string;
    category: ProductCategory;
    unit: ProductUnit;
    costPrice: number;
    sellingPrice: number;
    tiers: { minimumQuantity: number; pricePerUnit: number }[];
    stock: number;
  }> = [
    {
      name: 'Disposable plates 10" (100 pack)',
      category: ProductCategory.TABLEWARE,
      unit: ProductUnit.PACK,
      costPrice: 380,
      sellingPrice: 450,
      tiers: [
        { minimumQuantity: 1, pricePerUnit: 450 },
        { minimumQuantity: 5, pricePerUnit: 420 },
        { minimumQuantity: 20, pricePerUnit: 390 },
      ],
      stock: 500,
    },
    {
      name: 'Paper cups 200ml (100 pack)',
      category: ProductCategory.TABLEWARE,
      unit: ProductUnit.PACK,
      costPrice: 150,
      sellingPrice: 180,
      tiers: [
        { minimumQuantity: 1, pricePerUnit: 180 },
        { minimumQuantity: 10, pricePerUnit: 165 },
        { minimumQuantity: 40, pricePerUnit: 150 },
      ],
      stock: 800,
    },
    {
      name: 'Tissue boxes (6 pack)',
      category: ProductCategory.TISSUE_AND_HYGIENE,
      unit: ProductUnit.PACK,
      costPrice: 270,
      sellingPrice: 320,
      tiers: [
        { minimumQuantity: 1, pricePerUnit: 320 },
        { minimumQuantity: 8, pricePerUnit: 295 },
      ],
      stock: 400,
    },
    {
      name: 'Corrugated boxes 12x10x8 (bundle of 25)',
      category: ProductCategory.PACKAGING_AND_CARRY_BAGS,
      unit: ProductUnit.PACK,
      costPrice: 820,
      sellingPrice: 980,
      tiers: [
        { minimumQuantity: 1, pricePerUnit: 980 },
        { minimumQuantity: 4, pricePerUnit: 920 },
        { minimumQuantity: 12, pricePerUnit: 860 },
      ],
      stock: 120,
    },
  ];

  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        category: p.category,
        unit: p.unit,
      },
    });
    await prisma.inventoryBatch.create({
      data: {
        productId: product.id,
        batchNumber: 1,
        costPrice: new Prisma.Decimal(p.costPrice),
        sellingPrice: new Prisma.Decimal(p.sellingPrice),
        quantity: p.stock,
        bulkTiers: p.tiers as unknown as Prisma.InputJsonValue,
      },
    });
  }

  for (const rider of [
    {
      name: 'Ravi Kumar',
      phone: '+919888111222',
      currentLocation: { lat: 12.97, lng: 77.59 },
    },
    {
      name: 'Suresh Patil',
      phone: '+919888333444',
      currentLocation: { lat: 12.93, lng: 77.62 },
    },
  ]) {
    const riderUser = await prisma.user.create({
      data: {
        phone: rider.phone,
        name: rider.name,
        businessName: rider.name,
        role: UserRole.RIDER,
        isOnboardingCompleted: true,
      },
    });

    await prisma.rider.create({
      data: {
        userId: riderUser.id,
        name: rider.name,
        phone: rider.phone,
        status: RiderStatus.IDLE,
        currentLocation: rider.currentLocation,
      },
    });
  }
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
