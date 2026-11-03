import {
  Accessibility, Coffee, Droplets, Info, Pill, ShieldCheck,
  ShoppingBag, Ticket, Toilet, Utensils, Armchair, BatteryCharging, Luggage, HeartPulse, Search, TramFront,
  type LucideIcon, type LucideProps,
} from "lucide-react";
import type { FacilityCategory } from "@/lib/navigation/types";

export const facilityLabels: Record<FacilityCategory, string> = {
  washroom: "Washrooms", water: "Drinking water", food: "Food",
  tea: "Tea", shop: "Shops", pharmacy: "Pharmacy",
  information: "Information", tickets: "Tickets", waiting: "Waiting areas",
  accessible: "Accessible facilities", security: "Security & help",
  charging: "Charging points", luggage: "Luggage services", "first-aid": "First-aid assistance", "lost-found": "Lost & found", transit: "Transit interchange",
};
const icons: Record<FacilityCategory, LucideIcon> = {
  washroom: Toilet, water: Droplets, food: Utensils, tea: Coffee,
  shop: ShoppingBag, pharmacy: Pill, information: Info, tickets: Ticket,
  waiting: Armchair, accessible: Accessibility, security: ShieldCheck,
  charging: BatteryCharging, luggage: Luggage, "first-aid": HeartPulse, "lost-found": Search, transit: TramFront,
};
export function FacilityIcon({ category, ...props }: LucideProps & { category: FacilityCategory }) {
  const Icon = icons[category];
  return <Icon {...props} />;
}
