import {
  PrismaClient,
  ProductUnit,
  RiderStatus,
  UserRole,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.inventory.deleteMany();
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
      isDefault: true,
    },
  });

  const productsData: Array<{
    name: string;
    category: string;
    unit: ProductUnit;
    basePrice: number;
    tiers: { minQty: number; price: number }[];
    stock: number;
  }> = [
    {
      name: 'Disposable plates 10" (100 pack)',
      category: 'plates',
      unit: ProductUnit.PACK,
      basePrice: 450,
      tiers: [
        { minQty: 5, price: 420 },
        { minQty: 20, price: 390 },
      ],
      stock: 500,
    },
    {
      name: 'Paper cups 200ml (100 pack)',
      category: 'cups',
      unit: ProductUnit.PACK,
      basePrice: 180,
      tiers: [
        { minQty: 10, price: 165 },
        { minQty: 40, price: 150 },
      ],
      stock: 800,
    },
    {
      name: 'Tissue boxes (6 pack)',
      category: 'tissues',
      unit: ProductUnit.PACK,
      basePrice: 320,
      tiers: [{ minQty: 8, price: 295 }],
      stock: 400,
    },
    {
      name: 'Corrugated boxes 12x10x8 (bundle of 25)',
      category: 'packaging',
      unit: ProductUnit.PACK,
      basePrice: 980,
      tiers: [
        { minQty: 4, price: 920 },
        { minQty: 12, price: 860 },
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
        basePrice: new Prisma.Decimal(p.basePrice),
        bulkPricingTiers: p.tiers,
      },
    });
    await prisma.inventory.create({
      data: {
        productId: product.id,
        availableQty: p.stock,
        reservedQty: 0,
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
