const assert = require('node:assert/strict');
const vm = require('node:vm');
const { test } = require('node:test');
const { dashboard } = require('./dashboard-harness.cjs');

test('partnership suffix variants produce the same creative, creator and product key', () => {
  const context = dashboard();
  const names = [
    'Alwz_GS_vdo_edonna_p',
    'Alwz_GS_vdo_edonna-p',
    '파트너십_제품랜딩_F1844+_Alwz_GS_vdo_edonna_p',
    'Alwz_GS_vdo_edonna_P',
  ];
  for (const name of names) {
    context.name = name;
    assert.equal(vm.runInContext('parsePerson(name)', context), 'Partner');
    assert.equal(vm.runInContext('parseProduct(name)', context), 'GS');
    assert.equal(vm.runInContext('parseAdName(name)', context), 'edonna');
  }
  context.name = 'Alwz_GS_vdo_Phoebe';
  assert.equal(vm.runInContext('parsePerson(name)', context), 'Phoebe');
  context.name = 'Alwz_GS_vdo_p_review_Phoebe';
  assert.equal(vm.runInContext('isPartnershipName(name)', context), false);
  context.name = 'Alwz_GS_vdo_skin_care_p';
  assert.equal(vm.runInContext('parseAdName(name)', context), 'skin_care');
  context.name = 'Promotion_BD_vdo_handle_p';
  assert.equal(vm.runInContext('parseProduct(name)', context), 'PCB');
});

test('load and join purchases after Meta switches from full to short partnership name', async () => {
  const meta = [
    ['날짜', 'Contents 소재명', 'Link 링크클릭', 'Cost 광고비', 'Imp 노출', 'Campaign 캠페인명'],
    ['2026-10-06', '파트너십_제품랜딩_F1844+_Alwz_GS_vdo_edonna_p', 100, 1000, 200, 'GS Campaign'],
    ['2026-10-08', 'Alwz_GS_vdo_edonna_p', 200, 2000, 400, 'GS Campaign'],
    ['2026-10-09', 'Alwz_GS_vdo_edonna_p', 300, 3000, 600, 'GS Campaign'],
    ['2026-10-10', 'Alwz_GS_vdo_edonna_p', 400, 4000, 800, 'GS Campaign'],
  ];
  const amz = [
    ['날짜', 'Contents 소재명', '구매', '한화매출'],
    ['2026-10-08', 'Alwz_GS_vdo_edonna_p', 10, 258712.83],
    ['2026-10-09', 'Alwz_GS_vdo_edonna-p', 11, 274572.36],
    ['2026-10-10', 'Alwz_GS_vdo_edonna_p', 10, 248561.10],
  ];
  const context = dashboard(meta, amz);
  await vm.runInContext('loadData()', context);
  assert.equal(vm.runInContext('RAW.meta.length', context), 4);
  assert.equal(vm.runInContext('RAW.amz.length', context), 3);
  for (const filter of ['All', 'GS Campaign']) {
    context.filter = filter;
    vm.runInContext('cFilters.campaign=filter', context);
    const ads = vm.runInContext("computeData('2026-10-01','2026-10-31').ads", context);
    assert.equal(ads.length, 1);
    assert.equal(ads[0].ad_name, 'edonna');
    assert.equal(ads[0].person, 'Partner');
    assert.equal(ads[0].purchases, 31);
    assert.equal(ads[0].spend, 10000);
    assert.ok(Math.abs(ads[0].revenue - 781846.29) < 0.01);
  }
});

test('Amazon-only partnership purchases remain visible without a campaign filter', async () => {
  const context = dashboard([], [
    ['날짜', 'Contents 소재명', '구매', '한화매출'],
    ['2026-10-08', 'Alwz_GS_vdo_edonna_p', 10, 258712.83],
  ]);
  await vm.runInContext('loadData()', context);
  const ads = vm.runInContext("computeData('2026-10-01','2026-10-31').ads", context);
  assert.equal(ads.length, 1);
  assert.equal(ads[0].purchases, 10);
  assert.equal(ads[0].spend, 0);
});

test('only the two approved nonstandard names are partnership exceptions', () => {
  const context = dashboard();
  for (const name of ['Alwz_GS_vdo_Milkeydew p', 'Alwz_GS_vdo_what_is_lada-p 2']) {
    context.name = name;
    assert.equal(vm.runInContext('parsePerson(name)', context), 'Partner');
    assert.equal(vm.runInContext('parseProduct(name)', context), 'GS');
    assert.equal(vm.runInContext('parseMedia(name)', context), 'vdo');
  }
  for (const name of ['Alwz_GS_vdo_other p', 'Alwz_GS_vdo_other-p 2', 'Alwz_PCO_vdo_Milkeydew p']) {
    context.name = name;
    assert.equal(vm.runInContext('isPartnershipName(name)', context), false);
  }
});

test('approved exceptions load and join without merging the numbered duplicate into the original', async () => {
  const context = dashboard([
    ['날짜', 'Contents 소재명', 'Link 링크클릭', 'Cost 광고비', 'Imp 노출', 'Campaign 캠페인명'],
    ['2026-10-08', 'Alwz_GS_vdo_Milkeydew p', 86, 106100, 1000, 'GS Campaign'],
    ['2026-10-08', 'Alwz_GS_vdo_what_is_lada-p 2', 80, 101245, 1000, 'GS Campaign'],
    ['2026-10-08', 'Alwz_GS_vdo_what_is_lada-p', 100, 50000, 1000, 'GS Campaign'],
  ], [
    ['날짜', 'Contents 소재명', '구매', '한화매출'],
    ['2026-10-08', 'Alwz_GS_vdo_Milkeydew p', 7, 70000],
    ['2026-10-08', 'Alwz_GS_vdo_what_is_lada-p 2', 3, 30000],
    ['2026-10-08', 'Alwz_GS_vdo_what_is_lada-p', 13, 130000],
  ]);
  await vm.runInContext('loadData()', context);
  assert.equal(vm.runInContext('RAW.meta.length', context), 3);
  assert.equal(vm.runInContext('RAW.amz.length', context), 3);
  for (const filter of ['All', 'GS Campaign']) {
    context.filter = filter;
    vm.runInContext('cFilters.campaign=filter', context);
    const ads = vm.runInContext("computeData('2026-10-01','2026-10-31').ads", context);
    assert.equal(ads.length, 3);
    const milkeydew = ads.find(r => r.ad_name === 'Milkeydew p');
    const duplicate = ads.find(r => r.ad_name === 'what_is_lada-p 2');
    const original = ads.find(r => r.ad_name === 'what_is_lada');
    assert.equal(milkeydew.person, 'Partner');
    assert.equal(milkeydew.spend, 106100);
    assert.equal(milkeydew.purchases, 7);
    assert.equal(duplicate.spend, 101245);
    assert.equal(duplicate.purchases, 3);
    assert.equal(original.purchases, 13);
    assert.equal(ads.reduce((sum, r) => sum + r.purchases, 0), 23);
    assert.equal(ads.reduce((sum, r) => sum + r.revenue, 0), 230000);
  }
});

test('thumbnail matches renamed partnership spaces and underscores without matching another variant', () => {
  const context = dashboard();
  vm.runInContext(`AD_IMAGES=[
    {n:'파트너십_제품랜딩_F1830+_Alwz_GS_vdo_mishka_dii2-p',u:'https://example.com/wrong.png',d:'2026-10-02'},
    {n:'파트너십_제품랜딩_F1830+_Alwz_GS_vdo_mishka_dii3-p',u:'https://example.com/right.png',d:'2026-10-06'},
    {n:'파트너십_제품랜딩_F1830+_Alwz_PCO_vdo_l_yuhann',u:'https://example.com/yuhann.png',d:'2026-10-06'}
  ]`, context);
  assert.equal(vm.runInContext("getAdImg('mishka dii3','GS','Partner','2026-10-01','2026-10-31','vdo')", context), 'https://example.com/right.png');
  assert.equal(vm.runInContext("getAdImg('l_yuhann','PCO','Partner','2026-10-01','2026-10-31','vdo')", context), 'https://example.com/yuhann.png');
  assert.equal(vm.runInContext("getAdImg('mishka dii4','GS','Partner','2026-10-01','2026-10-31','vdo')", context), '');
});

test('Amazon -CREATIVE partnership rows join the matching Meta product and handle', async () => {
  const date = '2026-11-20';
  const creatives = [
    ['GPG', 'chxxry.glowy'],
    ['GPG', 'nicoletazmau'],
    ['PCO', 'minseon.kimm'],
    ['PCO', 'yejj.lee'],
  ];
  const context = dashboard([
    ['날짜', 'Contents 소재명', 'Link 링크클릭', 'Cost 광고비', 'Imp 노출', 'Campaign 캠페인명'],
    ...creatives.map(([product, handle]) => [
      date, `파트너십_제품랜딩_Alwz_${product}_vdo_${handle}-p`, 50, 10000, 500, 'Partnership Campaign',
    ]),
    [date, 'Alwz_PCO_vdo_nicoletazmau-p', 20, 5000, 200, 'PCO Campaign'],
  ], [
    ['날짜', 'Contents 소재명', '구매', '한화매출'],
    ...creatives.map(([product, handle], i) => [
      date, `Alwz_${product}_vdo_${handle}-p-CREATIVE`, i + 1, (i + 1) * 10000,
    ]),
    [date, 'Alwz_GPG_vdo_nicoletazmau-p', 5, 50000],
  ]);
  await vm.runInContext('loadData()', context);

  for (const campaign of ['All', 'Partnership Campaign']) {
    context.campaign = campaign;
    const ads = vm.runInContext("computeData('2026-11-01','2026-11-30',campaign).ads", context);
    assert.equal(ads.length, campaign === 'All' ? 5 : 4);
    creatives.forEach(([product, handle], i) => {
      const ad = ads.find(row => row.product === product && row.ad_name === handle);
      const purchases = i + 1 + (handle === 'nicoletazmau' ? 5 : 0);
      assert.equal(ad.person, 'Partner');
      assert.equal(ad.spend, 10000);
      assert.equal(ad.purchases, purchases);
      assert.equal(ad.revenue, purchases * 10000);
    });
    assert.equal(ads.reduce((sum, row) => sum + row.purchases, 0), 15);
    assert.equal(ads.reduce((sum, row) => sum + row.revenue, 0), 150000);
  }
});
