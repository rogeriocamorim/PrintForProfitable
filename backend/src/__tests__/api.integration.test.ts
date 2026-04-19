import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../index';
import prisma from '../services/prisma';

// Unique test user to avoid conflicts
const TEST_EMAIL = `test-${Date.now()}@integration.test`;
const TEST_PASSWORD = 'TestPass123!';
const TEST_NAME = 'Integration Test User';

let token: string;
let userId: string;
let farmId: string;

describe('Backend Integration Tests', () => {
  afterAll(async () => {
    // Clean up test user and all related data
    if (userId) {
      await prisma.model3D.deleteMany({ where: { farm: { userId } } });
      await prisma.shippingProfile.deleteMany({ where: { farm: { userId } } });
      await prisma.salesPlatform.deleteMany({ where: { farm: { userId } } });
      await prisma.filament.deleteMany({ where: { farm: { userId } } });
      await prisma.printer.deleteMany({ where: { farm: { userId } } });
      await prisma.taxRate.deleteMany({ where: { farm: { userId } } });
      await prisma.farm.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  // ─── Health ────────────────────────────────────────────────
  describe('Health', () => {
    it('GET /api/health returns ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  // ─── Auth ──────────────────────────────────────────────────
  describe('Auth', () => {
    it('POST /api/auth/register creates a user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD, name: TEST_NAME });

      expect(res.status).toBe(201);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.body.user.name).toBe(TEST_NAME);
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.farms).toHaveLength(1);

      token = res.body.token;
      userId = res.body.user.id;
      farmId = res.body.user.farms[0].id;
    });

    it('POST /api/auth/register rejects duplicate email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Dup' });
      expect(res.status).toBe(409);
    });

    it('POST /api/auth/register rejects missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'x@x.com' });
      expect(res.status).toBe(400);
    });

    it('POST /api/auth/login succeeds with correct creds', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: TEST_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe(TEST_EMAIL);
    });

    it('POST /api/auth/login fails with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: TEST_EMAIL, password: 'wrong' });
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/me returns { user } wrapper', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(TEST_EMAIL);
      expect(res.body.user.farms).toHaveLength(1);
    });

    it('GET /api/auth/me rejects without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('GET /api/auth/providers returns boolean flags', async () => {
      const res = await request(app).get('/api/auth/providers');
      expect(res.status).toBe(200);
      expect(typeof res.body.google).toBe('boolean');
      expect(typeof res.body.github).toBe('boolean');
    });

    it('Protected routes reject invalid tokens', async () => {
      const res = await request(app)
        .get('/api/farms')
        .set('Authorization', 'Bearer invalid-token-here');
      expect(res.status).toBe(401);
    });

    it('OAuth endpoints return 501 when not configured', async () => {
      const res = await request(app).get('/api/auth/google');
      expect(res.status).toBe(501);
    });
  });

  // ─── Farms ─────────────────────────────────────────────────
  describe('Farms', () => {
    it('GET /api/farms returns the user farm', async () => {
      const res = await request(app)
        .get('/api/farms')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(farmId);
    });

    it('PUT /api/farms updates farm settings', async () => {
      const res = await request(app)
        .put('/api/farms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Print Farm',
          electricityRate: 0.15,
          laborRate: 20,
          targetProfitMargin: 45,
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test Print Farm');
      expect(res.body.targetProfitMargin).toBe(45);
    });
  });

  // ─── Tax Rates ─────────────────────────────────────────────
  let taxRateId: string;

  describe('Tax Rates', () => {
    it('POST /api/farms/tax-rates creates a tax rate', async () => {
      const res = await request(app)
        .post('/api/farms/tax-rates')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Sales Tax', rate: 8.5 });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Sales Tax');
      expect(res.body.rate).toBe(8.5);
      taxRateId = res.body.id;
    });

    it('DELETE /api/farms/tax-rates/:id removes tax rate', async () => {
      const res = await request(app)
        .delete(`/api/farms/tax-rates/${taxRateId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });

  // ─── Printers ──────────────────────────────────────────────
  let printerId: string;

  describe('Printers', () => {
    it('POST /api/printers creates a printer', async () => {
      const res = await request(app)
        .post('/api/printers')
        .set('Authorization', `Bearer ${token}`)
        .send({ brand: 'Bambu Lab', model: 'X1C', powerConsumption: 220 });

      expect(res.status).toBe(201);
      expect(res.body.brand).toBe('Bambu Lab');
      expect(res.body.model).toBe('X1C');
      expect(res.body.powerConsumption).toBe(220);
      printerId = res.body.id;
    });

    it('GET /api/printers lists printers', async () => {
      const res = await request(app)
        .get('/api/printers')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/printers/:id updates a printer', async () => {
      const res = await request(app)
        .put(`/api/printers/${printerId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ brand: 'Bambu Lab', model: 'P1S', powerConsumption: 150 });

      expect(res.status).toBe(200);
      expect(res.body.model).toBe('P1S');
      expect(res.body.powerConsumption).toBe(150);
    });

    it('DELETE /api/printers/:id deletes a printer', async () => {
      const res = await request(app)
        .delete(`/api/printers/${printerId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });

  // ─── Filaments ─────────────────────────────────────────────
  let filamentId: string;

  describe('Filaments', () => {
    it('POST /api/filaments creates a filament', async () => {
      const res = await request(app)
        .post('/api/filaments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'Hatchbox',
          material: 'PLA',
          variant: 'Basic',
          costPerSpool: 25.99,
          spoolWeight: 1000,
          colors: ['Black'],
        });

      expect(res.status).toBe(201);
      expect(res.body.brand).toBe('Hatchbox');
      expect(res.body.material).toBe('PLA');
      expect(res.body.variant).toBe('Basic');
      filamentId = res.body.id;
    });

    it('GET /api/filaments lists filaments', async () => {
      const res = await request(app)
        .get('/api/filaments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/filaments/:id updates a filament', async () => {
      const res = await request(app)
        .put(`/api/filaments/${filamentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ variant: 'Pro', colors: ['White', 'Black'] });

      expect(res.status).toBe(200);
      expect(res.body.variant).toBe('Pro');
    });

    it('DELETE /api/filaments/:id deletes a filament', async () => {
      const res = await request(app)
        .delete(`/api/filaments/${filamentId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });

  // ─── Platforms ─────────────────────────────────────────────
  let platformId: string;

  describe('Platforms', () => {
    it('POST /api/platforms creates a platform', async () => {
      const res = await request(app)
        .post('/api/platforms')
        .set('Authorization', `Bearer ${token}`)
        .send({
          type: 'ETSY',
          shopName: 'MyEtsyShop',
          feesConfig: { percentage: 6.5, flat: 0.2 },
          enabled: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('ETSY');
      expect(res.body.shopName).toBe('MyEtsyShop');
      platformId = res.body.id;
    });

    it('GET /api/platforms lists platforms', async () => {
      const res = await request(app)
        .get('/api/platforms')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/platforms/:id updates a platform', async () => {
      const res = await request(app)
        .put(`/api/platforms/${platformId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ feesConfig: { percentage: 7.0, flat: 0.25 } });

      expect(res.status).toBe(200);
      expect(res.body.feesConfig.percentage).toBe(7.0);
    });

    it('DELETE /api/platforms/:id deletes a platform', async () => {
      const res = await request(app)
        .delete(`/api/platforms/${platformId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });

  // ─── Shipping ──────────────────────────────────────────────
  let shippingId: string;

  describe('Shipping', () => {
    it('POST /api/shipping creates a shipping profile', async () => {
      const res = await request(app)
        .post('/api/shipping')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Standard Shipping',
          customerPays: 5.99,
          postageCost: 4.50,
          deliveryMinDays: 3,
          deliveryMaxDays: 7,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Standard Shipping');
      expect(res.body.customerPays).toBe(5.99);
      shippingId = res.body.id;
    });

    it('GET /api/shipping lists shipping profiles', async () => {
      const res = await request(app)
        .get('/api/shipping')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('PUT /api/shipping/:id updates a shipping profile', async () => {
      const res = await request(app)
        .put(`/api/shipping/${shippingId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ customerPays: 6.99 });

      expect(res.status).toBe(200);
      expect(res.body.customerPays).toBe(6.99);
    });

    it('DELETE /api/shipping/:id deletes a shipping profile', async () => {
      const res = await request(app)
        .delete(`/api/shipping/${shippingId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });

  // ─── Models (with pricing) ─────────────────────────────────
  let modelId: string;

  describe('Models', () => {
    let modelFilamentId: string;

    beforeAll(async () => {
      // Create filament for model
      const filamentRes = await request(app)
        .post('/api/filaments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brand: 'TestBrand',
          material: 'PLA',
          variant: 'Standard',
          costPerSpool: 20,
          spoolWeight: 1000,
        });
      modelFilamentId = filamentRes.body.id;
    });

    it('POST /api/models creates a model', async () => {
      const res = await request(app)
        .post('/api/models')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Phone Stand',
          printTimeMinutes: 150,
          filamentUsageGrams: 65,
          filamentId: modelFilamentId,
        });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Phone Stand');
      expect(res.body.printTimeMinutes).toBe(150);
      expect(res.body.filamentUsageGrams).toBe(65);
      modelId = res.body.id;
    });

    it('GET /api/models lists models', async () => {
      const res = await request(app)
        .get('/api/models')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/models/:id returns model with pricing breakdown', async () => {
      const res = await request(app)
        .get(`/api/models/${modelId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Phone Stand');
      // Pricing breakdown nested under pricing object
      expect(res.body.pricing).toBeDefined();
      expect(res.body.pricing.materialCost).toBeGreaterThan(0);
      expect(res.body.pricing.electricityCost).toBeGreaterThanOrEqual(0);
      expect(res.body.pricing.laborCost).toBeGreaterThanOrEqual(0);
      expect(res.body.pricing.totalCost).toBeGreaterThan(0);
      expect(res.body.pricing.suggestedPrice).toBeGreaterThan(res.body.pricing.totalCost);
    });

    it('DELETE /api/models/:id deletes a model', async () => {
      const res = await request(app)
        .delete(`/api/models/${modelId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Model deleted');
    });
  });

  // ─── Wizard ────────────────────────────────────────────────
  describe('Wizard', () => {
    it('PUT /api/wizard/step1 updates farm basics', async () => {
      const res = await request(app)
        .put('/api/wizard/step1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Wizard Test Farm',
          electricityRate: 0.12,
          laborRate: 15,
          targetProfitMargin: 40,
          taxRates: [{ name: 'State Tax', rate: 6 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Wizard Test Farm');
      expect(res.body.taxRates).toHaveLength(1);
    });

    it('PUT /api/wizard/step2 adds equipment', async () => {
      const res = await request(app)
        .put('/api/wizard/step2')
        .set('Authorization', `Bearer ${token}`)
        .send({
          printers: [{ brand: 'Creality', model: 'Ender 3', powerConsumption: 180 }],
          filaments: [{ brand: 'WizBrand', material: 'PETG', variant: 'Tough', costPerSpool: 30, spoolWeight: 1000, colors: ['Blue'] }],
        });

      expect(res.status).toBe(200);
      expect(res.body.printers).toHaveLength(1);
      expect(res.body.filaments).toHaveLength(1);
    });

    it('PUT /api/wizard/step3 adds sales platforms', async () => {
      const res = await request(app)
        .put('/api/wizard/step3')
        .set('Authorization', `Bearer ${token}`)
        .send({
          salesPlatforms: [{ type: 'AMAZON', shopName: 'TestAmazonShop', feesConfig: { percentage: 15 }, enabled: true }],
          shippingProfiles: [{ name: 'Express', customerPays: 9.99, postageCost: 7.00, deliveryMinDays: 1, deliveryMaxDays: 3 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.salesPlatforms).toHaveLength(1);
      expect(res.body.shippingProfiles).toHaveLength(1);
    });

    it('GET /api/wizard/status returns completion status', async () => {
      const res = await request(app)
        .get('/api/wizard/status')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.hasFarm).toBe(true);
      expect(res.body.steps.step1).toBe(true);
      expect(res.body.steps.step2).toBe(true);
      expect(res.body.steps.step3).toBe(true);
    });
  });
});
