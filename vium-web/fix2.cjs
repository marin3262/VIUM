const fs = require('fs');

function fixFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  content = replacer(content);
  fs.writeFileSync(path, content, 'utf8');
}

fixFile('src/App.tsx', content => content.replace('triggerRewardAnimation(amount, "충전 완료 보상");', 'triggerRewardAnimation(amount);'));
fixFile('src/components/station/ReviewModal.tsx', content => content.replace('triggerRewardAnimation(100, `리뷰 작성 보상: ${station.station_name}`);', 'triggerRewardAnimation(100);'));
fixFile('src/components/station/StationMap.tsx', content => content.replace('setIsAnimating(false);', '').replace('setIsAnimating(true);', ''));
fixFile('src/components/station/StationModal.tsx', content => content.replace(/const faultyChargers = useMemo\(\(\) => \n    station.chargers.filter\(c => c.status === 'Faulty'\),\n    \[station.chargers\]\n  \);/, ''));

console.log("Fixed part 2!");
