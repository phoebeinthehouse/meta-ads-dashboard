const assert = require('node:assert/strict');
const vm = require('node:vm');
const { test } = require('node:test');
const { dashboard } = require('./dashboard-harness.cjs');

const mh = ['날짜','Contents 소재명','Link 링크클릭','Cost 광고비','Imp 노출','Campaign 캠페인명'];
const ah = ['날짜','Contents 소재명','구매','한화매출'];
const sum = (rows, key) => rows.reduce((s,r)=>s+r[key],0);

test('different reporting dates match each creative and product once across renamed candidates and campaigns', async () => {
  const c = dashboard([mh,
    ['2026-10-01','파트너십_제품랜딩_F1830+_Alwz_PCO_vdo_chxrry.glowy-p',10,100,100,'A'],
    ['2026-10-02','Alwz_PCO_vdo_chxrry.glowy-p',30,300,300,'B'],
    ['2026-10-02','Alwz_GS_vdo_chxrry.glowy-p',20,200,200,'C'],
    ['2026-10-02','PCO_vdo_chxrry.glowy_Phoebe',5,50,50,'D'],
  ], [ah,
    ['2026-10-08','Alwz_PCO_vdo_chxrry.glowy-p',3,400],
    ['2026-10-09','Alwz_PCO_vdo_chxrry.glowy-p',2,400],
    ['2026-10-08','Alwz_GS_vdo_chxrry.glowy-p',7,1400],
    ['2026-10-08','PCO_vdo_chxrry.glowy_Phoebe',1,100],
    ['2026-11-01','Alwz_PCO_vdo_chxrry.glowy-p',100,10000],
  ]);
  await vm.runInContext('loadData()',c);
  const d = vm.runInContext("computeData('2026-10-01','2026-10-31','All')",c);
  assert.equal(d.ads.length,3);
  const pco = d.ads.find(r=>r.product==='PCO'&&r.person==='Partner');
  assert.equal(pco.purchases,5);
  assert.equal(pco.revenue,800);
  assert.equal(pco.spend,400);
  assert.equal(pco.unmatched_spend,0);
  assert.equal(pco.roas,500);
  assert.equal(d.ads.find(r=>r.product==='GS').purchases,7);
  assert.equal(d.ads.find(r=>r.person==='Phoebe').purchases,1);
  assert.equal(d.total.purchases,13);
  assert.equal(d.total.revenue,2300);
  for (const key of ['spendGap','purchasesGap','revenueGap']) assert.equal(d.integrity[key],0);
  let purchases=0, revenue=0;
  for (const campaign of ['A','B','C','D']) {
    c.campaign=campaign;
    const filtered=vm.runInContext("computeData('2026-10-01','2026-10-31',campaign)",c);
    purchases+=sum(filtered.ads,'purchases');
    revenue+=sum(filtered.ads,'revenue');
    assert.equal(filtered.integrity.spendGap,0);
  }
  assert.equal(purchases,13);
  assert.equal(revenue,2300);
  const narrow=vm.runInContext("computeData('2026-10-08','2026-10-09','All')",c);
  assert.ok(narrow.ads.every(r=>r.amz_only));
  assert.equal(narrow.total.purchases,13);
});

test('By Product hides unclassified cards and creator rows while preserving source totals and Partner', async () => {
  const c=dashboard([mh,
    ['2026-10-01','이름 오류',1,100,10,'A'],
    ['2026-10-01','GS_vdo_test_unknown',2,200,20,'A'],
    ['2026-10-01','GS_vdo_test_Phoebe',3,300,30,'A'],
    ['2026-10-01','Alwz_GS_vdo_partner_p',4,400,40,'A'],
  ],[ah,['2026-10-08','이름 오류',2,500]]);
  await vm.runInContext('loadData()',c);
  vm.runInContext('renderProdPage()',c);
  for (const id of ['psgrid','pdgrid']) {
    assert.ok(!c.document.getElementById(id).innerHTML.includes('미분류'));
    assert.ok(c.document.getElementById(id).innerHTML.includes('GS'));
  }
  assert.ok(c.document.getElementById('pdgrid').innerHTML.includes('Partner'));
  assert.ok(c.document.getElementById('pdgrid').innerHTML.includes('Phoebe'));
  assert.equal(vm.runInContext('D().total.spend',c),1000);
  assert.equal(vm.runInContext('D().total.purchases',c),2);
  assert.equal(vm.runInContext('D().total.revenue',c),500);
  assert.equal(vm.runInContext('D().integrity.spendGap',c),0);
});
