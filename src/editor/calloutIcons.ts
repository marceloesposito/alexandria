// Icone dei riquadri evidenziati: dal nome salvato nel documento al componente di lucide.
import {
  Info, Lightbulb, Star, TriangleAlert, OctagonAlert, BookOpen, Bookmark, Pencil, Quote, Flag, CircleCheck, CircleHelp,
  Target, FlaskConical, GraduationCap, List, Link, Calendar, User, MessageSquare, Eye, Key, Heart, Sparkles,
} from 'lucide-react';
import type { CalloutIcon } from '../doc/callouts';

export const CALLOUT_ICON_COMPONENTS: Record<CalloutIcon, typeof Info> = {
  info: Info,
  lightbulb: Lightbulb,
  star: Star,
  'triangle-alert': TriangleAlert,
  'octagon-alert': OctagonAlert,
  'book-open': BookOpen,
  bookmark: Bookmark,
  pencil: Pencil,
  quote: Quote,
  flag: Flag,
  'circle-check': CircleCheck,
  'circle-help': CircleHelp,
  target: Target,
  'flask-conical': FlaskConical,
  'graduation-cap': GraduationCap,
  list: List,
  link: Link,
  calendar: Calendar,
  user: User,
  'message-square': MessageSquare,
  eye: Eye,
  key: Key,
  heart: Heart,
  sparkles: Sparkles,
};
