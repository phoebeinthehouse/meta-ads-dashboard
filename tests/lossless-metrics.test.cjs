const assert = require('node:assert/strict');
const vm = require('node:vm');
const { test } = require('node:test');
const { dashboard } = require('./dashboard-harness.cjs');

const mh = ['날짜', 'Contents 소재명', 'Link 링크클릭', 'Cost 광고비', 'Imp 노출', 'Campaign 캠페인명'];
const ah = ['날짜', 'Contents 소재명', '구매', '한화매출', 'Campaign 캠페인명'];
const sum = (rows, k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test('unknown owners/products, empty names, Stella and zero-delivery ads preserve source totals', async () => {
  const meta = [mh,
    ['2026-10-01', 'Alwz_GPG_vdo_chxrry_stella', 10, 100, 100, 'A'],
    ['2026-10-01', '새 매출 광고', 20, 200, 200, 'A'],
    ['2026-10-02', 'GPG_img__seoyoon', 30, 300, 300, 'B'],
    ['2026-10-02', 'Lina_ALL_img_bundle', 40, 400, 400, 'B'],
    ['2026-10-02', '', 50, 500, 500, 'C'],
    ['2026-10-02', 'GPG_img_zero_Phoebe', 0, 0, 0, 'C'],
    ['2026-10-02', 'Alwz_GS_vdo_edonna_p', 5, 50, 50, 'C'],
  ];
  const amz = [ah,
    ['2026-10-01', 'Alwz_GPG_vdo_chxrry_stella', 2, 200],
    ['2026-10-01', '미식별 소재 (26.09_PCO_상시_None Target)', 3, 300],
    ['2026-10-02', '', 4, 400, 'unknown campaign'],
    ['2026-10-02', 'GPG_img_zero_Phoebe', 0, 0],
    ['2026-10-02', 'Alwz_GS_vdo_edonna_p', 1, 100],
  ];
  const c = dashboard(meta, amz);
  await vm.runInContext('loadData()', c);
  assert.equal(vm.runInContext('RAW.meta.length', c), 7);
  assert.equal(vm.runInContext('RAW.amz.length', c), 5);
  const d = vm.runInContext("computeData('2026-10-01','2026-10-31')", c);
  for (const view of ['ads', 'ps', 'pp', 'psum', 'daily']) {
    near(sum(d[view], 'spend'), 1550);
    near(sum(d[view], 'purchases'), 10);
    near(sum(d[view], 'revenue'), 1000);
  }
  near(d.total.roas, 1000 / 1550 * 100 / 0.4);
  near(d.integrity.spendGap, 0);
  near(d.integrity.purchasesGap, 0);
  near(d.integrity.revenueGap, 0);
  assert.ok(d.ads.some(r => r.ad_name === 'GPG_img__seoyoon'));
  assert.ok(d.ads.some(r => r.ad_name === 'zero' && r.spend === 0));
  assert.ok(d.ps.some(r => r.person === 'Partner'));
  assert.ok(d.ps.some(r => r.person === 'Stella'));
  assert.ok(d.psum.some(r => r.product === 'ALL'));
  assert.equal(d.ads.find(r => r.ad_name === '새 매출 광고').roas, null);
  assert.equal(d.ads.find(r => r.ad_name === 'chxrry').purchases, 2);
});

test('boundary whitespace and extra partnership targeting tokens do not break identities', async () => {
  const c = dashboard([mh,
    ['2026-02-01', '리타겟_제품랜딩_BD_GPG_ vdo_PatchyMakeup_Lina', 1, 100, 10, 'A'],
    ['2026-02-01', 'Adv_제품랜딩_Alwz_F1830+_GPG_vdo_chxrry-p_stella', 1, 200, 10, 'A'],
  ], [ah,
    ['2026-02-01', 'BD_GPG_vdo_PatchyMakeup_Lina', 2, 300],
    ['2026-02-01', 'Alwz_adv_GPG_vdo_chxrry-p_stella', 3, 400],
  ]);
  await vm.runInContext('loadData()', c);
  const ads = vm.runInContext("computeData('2026-02-01','2026-02-28').ads", c);
  assert.equal(ads.length, 2);
  const patchy = ads.find(r => r.ad_name === 'PatchyMakeup');
  assert.equal(patchy.media, 'vdo');
  assert.equal(patchy.purchases, 2);
  assert.equal(patchy.roas, 750);
  const partner = ads.find(r => r.person === 'Partner');
  assert.equal(partner.product, 'GPG');
  assert.equal(partner.purchases, 3);
  assert.equal(partner.roas, 500);
});

test('campaign filtering retains source spend and uses the shared full-scope allocation', async () => {
  const c = dashboard([mh,
    ['2026-10-01', 'GS_vdo_test_Phoebe', 10, 100, 100, 'A'],
    ['2026-10-01', 'GS_vdo_test_Phoebe', 30, 300, 300, 'B'],
  ], [ah, ['2026-10-01', 'GS_vdo_test_Phoebe', 3, 400]]);
  await vm.runInContext('loadData()', c);
  let purchases = 0, revenue = 0;
  for (const [campaign, spend] of [['A', 100], ['B', 300]]) {
    c.campaign = campaign;
    vm.runInContext('cFilters.campaign=campaign', c);
    const d = vm.runInContext("computeData('2026-10-01','2026-10-31')", c);
    near(sum(d.ads, 'spend'), spend);
    near(d.integrity.spendGap, 0);
    purchases += sum(d.ads, 'purchases');
    revenue += sum(d.ads, 'revenue');
  }
  near(purchases, 3);
  near(revenue, 400);
});

test('refunds and unmatched Amazon zero rows are retained without claiming a verified creative ROAS', async () => {
  const c = dashboard([mh,
    ['2026-10-01', 'GS_vdo_test_Phoebe', 10, 100, 100, 'A'],
  ], [ah,
    ['2026-10-01', 'GS_vdo_test_Phoebe', -1, -50],
    ['2026-10-01', 'GPG_img_amazononly_Iris', 0, 0],
  ]);
  await vm.runInContext('loadData()', c);
  const d = vm.runInContext("computeData('2026-10-01','2026-10-31')", c);
  near(sum(d.ads, 'purchases'), -1);
  near(sum(d.ads, 'revenue'), -50);
  assert.equal(d.ads.find(r => r.ad_name === 'test').roas, -125);
  assert.ok(d.ads.some(r => r.ad_name === 'amazononly' && r.amz_only));
});

test('financial rows with invalid dates fail visibly instead of disappearing', async () => {
  const c = dashboard([mh, ['invalid date', 'GS_vdo_test_Phoebe', 10, 100, 100, 'A']], []);
  await assert.rejects(vm.runInContext('loadData()', c), /Meta 날짜 확인 필요/);
});

test('a literal null asset name is retained and malformed financial values fail visibly', async () => {
  const c = dashboard([mh, ['2026-10-01', 'null', 1, 100, 10, 'A']], []);
  await vm.runInContext('loadData()', c);
  const ads = vm.runInContext("computeData('2026-10-01','2026-10-31').ads", c);
  assert.equal(ads.length, 1);
  assert.equal(ads[0].spend, 100);
  const invalid = dashboard([mh, ['2026-10-01', 'GS_vdo_test_Phoebe', 1, '#VALUE!', 10, 'A']], []);
  await assert.rejects(vm.runInContext('loadData()', invalid), /숫자 확인 필요/);
});

test('reconciliation still detects a row removed after source capture', async () => {
  const c = dashboard([mh,
    ['2026-10-01', 'GS_vdo_test_Phoebe', 1, 100, 10, 'A'],
    ['2026-10-01', '새 매출 광고', 1, 200, 10, 'A'],
  ], []);
  await vm.runInContext('loadData()', c);
  vm.runInContext('RAW.meta=RAW.meta.slice(0,1)', c);
  const d = vm.runInContext("computeData('2026-10-01','2026-10-31')", c);
  assert.equal(d.total.spend, 300);
  assert.equal(d.integrity.spendGap, -200);
});

