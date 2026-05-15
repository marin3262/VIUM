const fs = require('fs');

function fixFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  content = replacer(content);
  fs.writeFileSync(path, content, 'utf8');
}

fixFile('src/types/index.ts', content => content.replace('trust_score?: number;', 'trust_score?: number;\n  is_admin?: boolean;'));

fixFile('src/store/notificationStore.ts', content => content.replace("type: 'SUCCESS' | 'ERROR' | 'INFO';", "type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING';"));

fixFile('src/components/admin/AdminDashboard.tsx', content => content
  .replace('import { Review }', 'import type { Review }')
  .replace('const [isLoading, setIsLoading] = useState(true);', '')
  .replace('setIsLoading(true);', '')
  .replace('setIsLoading(false);', '')
  .replace('icon: AlertCircle', 'icon: Clock') // Temp fix since AlertCircle is missing
  .replace('handleToggleReviewStatus(review.id, review.status)', 'handleToggleReviewStatus(review.id, review.status || "VISIBLE")')
);

fixFile('src/components/station/PillFilter.tsx', content => content.replace('import { ChargerType }', 'import type { ChargerType }'));

fixFile('src/components/station/StationMap.tsx', content => content.replace('const [isAnimating, setIsAnimating] = useState(false);', ''));

fixFile('src/components/station/StationModal.tsx', content => {
  return content
    .replace('X, MapPin, Zap, Clock, ShieldAlert, Navigation, Star, TrendingUp, \n  MessageSquare, AlertCircle, Car, Activity, Power, Wrench', 'X, MapPin, Zap, ShieldAlert, Navigation, Star, TrendingUp, \n  MessageSquare, Car, Activity, Power, Wrench')
    .replace(/let buttonText = '충전 시작하기';[\s\S]*?}\n  }/, '')
    .replace("import {\n  X, MapPin, Zap, ShieldAlert, Navigation, Star, TrendingUp,\n  MessageSquare, Car, Activity, Power, Wrench\n} from 'lucide-react';", "import { X, MapPin, Zap, ShieldAlert, Navigation, Star, TrendingUp, MessageSquare, Car, Activity, Power, Wrench } from 'lucide-react';");
});

fixFile('src/hooks/useMileage.ts', content => content.replace('reason?: string', ''));

console.log("Fixed!");
