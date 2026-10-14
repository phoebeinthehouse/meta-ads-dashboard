const assert = require('node:assert/strict');
const vm = require('node:vm');
const { test } = require('node:test');
const { dashboard } = require('./dashboard-harness.cjs');

test('all summary and daily metrics apply 40% once while preserving source money and counts', async () => {
  const c = dashboard([
    ['날짜','Contents 소재명','Link 링크클릭','Cost 광고비','Imp 노출'],
    ['2026-10-01','GS_vdo_test_Phoebe',10,40000,100],
    ['2026-10-02','GS_vdo_test_Phoebe',20,80000,200],
  ], [
    ['날짜','Contents 소재명','구매','한화매출'],
    ['2026-10-01','GS_vdo_test_Phoebe',2,40000],
    ['2026-10-02','GS_vdo_test_Phoebe',4,80000],
  ]);
  await vm.runInContext('loadData()', c);
  const d = vm.runInContext("computeData('2026-10-01','2026-10-31')", c);
  for (const view of ['ps','pm','daily','pp','psum','ads']) {
    assert.ok(d[view].every(r => r.roas === 250), view);
    assert.equal(d[view].reduce((s,r)=>s+r.spend,0),120000);
    assert.equal(d[view].reduce((s,r)=>s+r.revenue,0),120000);
    assert.equal(d[view].reduce((s,r)=>s+r.purchases,0),6);
  }
  assert.equal(d.total.roas,250);
  const product = vm.runInContext("computeProductDaily(['2026-10-01','2026-10-02'])", c);
  assert.ok(product.byProduct.GS.every(r=>r.roas===250));
  const creative = vm.runInContext("computeCreativeDaily(['2026-10-01','2026-10-02'],'All','All')", c);
  assert.equal(creative.creatives.length,1);
  assert.ok(Object.values(creative.byCreative).flat().every(r=>r.roas===250));
});

test('estimated ratios keep null, zero and refunds; round only at display time', () => {
  const c = dashboard();
  assert.equal(vm.runInContext('estimatedRoas(100,100)',c),250);
  assert.equal(vm.runInContext('estimatedRoas(0,100)',c),0);
  assert.equal(vm.runInContext('estimatedRoas(100,0)',c),null);
  assert.equal(vm.runInContext('estimatedRoas(-50,100)',c),-125);
  assert.equal(vm.runInContext('fd(estimatedRoas(1,3))',c),'83.33');
  assert.equal(vm.runInContext('isVisibleCreator("Partner")',c),false);
  assert.equal(vm.runInContext('isVisibleCreator("미분류")',c),false);
  assert.equal(vm.runInContext('isVisibleCreator("Stella")',c),true);
  vm.runInContext("curMonth='2026-09'",c);
  assert.equal(vm.runInContext('getDateRange().to',c),'2026-09-30');
  vm.runInContext("curMonth='2026-02'",c);
  assert.equal(vm.runInContext('getDateRange().to',c),'2026-02-28');
});

test('creator cards and both creator charts hide Partner and unclassified without removing their totals', async () => {
  const c = dashboard([
    ['날짜','Contents 소재명','Link 링크클릭','Cost 광고비','Imp 노출'],
    ['2026-10-01','GS_vdo_test_Phoebe',10,40000,100],
    ['2026-10-01','Alwz_GS_vdo_partner_p',20,80000,200],
    ['2026-10-01','이름 오류',30,120000,300],
  ], []);
  await vm.runInContext('loadData()',c);
  const charts=[];
  c.Chart=class {constructor(ctx,config){charts.push(config);}destroy(){}};
  vm.runInContext('renderPCards();renderTrend();renderMedia();updateMeta();',c);
  const cards=c.document.getElementById('pcards').innerHTML;
  assert.ok(cards.includes('Phoebe'));
  assert.ok(!cards.includes('Partner'));
  assert.ok(!cards.includes('미분류'));
  assert.deepEqual(Array.from(charts[0].data.datasets,r=>r.label),['Phoebe']);
  assert.deepEqual(Array.from(charts[1].data.labels),['Phoebe']);
  assert.equal(vm.runInContext('D().total.spend',c),240000);
  assert.equal(vm.runInContext('D().ads.length',c),3);
  assert.match(c.document.getElementById('attributionQALink').href,/from=2026-10-01&to=2026-10-31$/);
});

test('QA embedded view uses requested dates and the same dynamic estimated totals and notices', async () => {
  const c = dashboard([
    ['날짜','Contents 소재명','Link 링크클릭','Cost 광고비','Imp 노출'],
    ['2026-10-01','GS_vdo_test_Phoebe',10,40000,100],
    ['2026-10-02','이름 오류',20,10000,200],
  ], [
    ['날짜','Contents 소재명','구매','한화매출'],
    ['2026-10-01','GS_vdo_test_Phoebe',2,40000],
  ], '?view=qa&from=2026-10-01&to=2026-10-01');
  await vm.runInContext('loadData()',c);
  vm.runInContext('updateMeta()',c);
  assert.equal(c.document.getElementById('reconcileSummary').hidden,false);
  assert.match(c.document.getElementById('reconcileSummary').textContent,/전체 추정 ROAS 250.00%/);
  assert.equal(vm.runInContext('D().total.spend',c),40000);
  assert.equal(c.document.getElementById('attributionNotice').style.display,'none');
  vm.runInContext("customTo='2026-10-02';updateMeta()",c);
  assert.match(c.document.getElementById('reconcileSummary').textContent,/전체 추정 ROAS 200.00%/);
  assert.match(c.document.getElementById('attributionNotice').textContent,/미분류 1개 · 구매·매출 연결 확인 필요 1개/);
});

test('renamed Meta candidates join period purchases without requiring the same reporting dates', async () => {
  const c = dashboard([
    ['날짜','Contents 소재명','Link 링크클릭','Cost 광고비','Imp 노출'],
    ['2026-10-05','파트너십_제품랜딩_F1830+_Alwz_PCO_vdo_chxrry.glowy-p',10,40000,100],
    ['2026-10-08','Alwz_PCO_vdo_chxrry.glowy-p',20,80000,200],
    ['2026-10-08','Alwz_PCO_vdo_noamazon_p',5,20000,50],
    ['2026-10-05','파트너십_제품랜딩_F1830+_Alwz_PCO_vdo_zero_p',5,10000,50],
    ['2026-10-08','Alwz_PCO_vdo_zero_p',5,20000,50],
  ], [
    ['날짜','Contents 소재명','구매','한화매출'],
    ['2026-10-08','Alwz_PCO_vdo_chxrry.glowy-p',2,120000],
    ['2026-10-08','Alwz_PCO_vdo_zero_p',0,0],
  ]);
  await vm.runInContext('loadData()',c);
  const d=vm.runInContext("computeData('2026-10-01','2026-10-31')",c);
  const cherry=d.ads.find(r=>r.ad_name==='chxrry.glowy');
  assert.equal(cherry.spend,120000);
  assert.equal(cherry.revenue,120000);
  assert.equal(cherry.purchases,2);
  assert.equal(cherry.unmatched_spend,0);
  assert.equal(cherry.roas,250);
  assert.equal(d.ads.find(r=>r.ad_name==='zero').roas,0);
  assert.equal(d.ads.find(r=>r.ad_name==='noamazon').roas,null);
  assert.equal(d.total.spend,170000);
  assert.equal(d.total.revenue,120000);
  assert.equal(d.integrity.spendGap,0);
  assert.equal(d.integrity.revenueGap,0);
  assert.equal(d.integrity.purchasesGap,0);
  vm.runInContext('updateMeta()',c);
  assert.match(c.document.getElementById('attributionNotice').textContent,/구매·매출 연결 확인 필요 1개/);
  const daily=vm.runInContext("computeCreativeDaily(['2026-10-05','2026-10-08'],'All','All')",c);
  const points=Object.values(daily.byCreative).find(points=>points.some(p=>p.revenue===120000));
  assert.equal(points[0].roas,null);
  assert.equal(points[1].roas,375);
});
