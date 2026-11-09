const assert = require('node:assert/strict');
const vm = require('node:vm');
const { test } = require('node:test');
const { dashboard } = require('./dashboard-harness.cjs');

const mh = ['날짜','Contents 소재명','Link 링크클릭','Cost 광고비','Imp 노출','Campaign 캠페인명'];
const ah = ['날짜','Contents 소재명','구매','한화매출'];

test('By Creator keeps Iris through October and excludes her rows from November onward', async () => {
  const c = dashboard([mh,
    ['2026-10-31','GS_vdo_october_Iris',10,100,100,'A'],
    ['2026-11-01','GS_vdo_november_Iris',20,200,200,'A'],
    ['2026-11-01','GS_vdo_november_Phoebe',30,300,300,'A'],
  ], [ah,
    ['2026-10-31','GS_vdo_october_Iris',1,1000],
    ['2026-11-01','GS_vdo_november_Iris',2,2000],
    ['2026-11-01','GS_vdo_november_Phoebe',3,3000],
  ]);
  await vm.runInContext('loadData()', c);

  const october = vm.runInContext("computeCreatorData('2026-10-01','2026-10-31')", c);
  assert.equal(october.ps.find(r => r.person === 'Iris').clicks, 10);
  assert.equal(october.ps.find(r => r.person === 'Iris').purchases, 1);

  const november = vm.runInContext("computeCreatorData('2026-11-01','2026-11-30')", c);
  assert.ok(!november.ps.some(r => r.person === 'Iris'));
  assert.equal(november.ps.find(r => r.person === 'Phoebe').clicks, 30);
  assert.equal(november.ps.find(r => r.person === 'Phoebe').purchases, 3);

  const mixed = vm.runInContext("computeCreatorData('2026-10-31','2026-11-01')", c);
  assert.equal(mixed.ps.find(r => r.person === 'Iris').clicks, 10);
  assert.equal(mixed.ps.find(r => r.person === 'Iris').purchases, 1);
});

test('Iris remains classified in full dashboard data for historical filters and source totals', async () => {
  const c = dashboard([mh,
    ['2026-11-01','GS_vdo_november_Iris',20,200,200,'A'],
  ], [ah,
    ['2026-11-01','GS_vdo_november_Iris',2,2000],
  ]);
  await vm.runInContext('loadData()', c);

  const full = vm.runInContext("computeData('2026-11-01','2026-11-30','All')", c);
  assert.equal(full.ads.find(r => r.person === 'Iris').clicks, 20);
  assert.equal(full.total.spend, 200);
  assert.equal(full.total.purchases, 2);
  assert.equal(full.integrity.spendGap, 0);
  assert.equal(full.integrity.purchasesGap, 0);
});
