import { Image } from 'expo-image';
import type { ColorValue } from 'react-native';
import logoMark from '../../../assets/brand/logo-mark.svg';
import bookAppointment from '../../../assets/brand/icons/book-appointment.svg';
import findADoctor from '../../../assets/brand/icons/find-a-doctor.svg';
import hmoCoverage from '../../../assets/brand/icons/hmo-coverage.svg';
import hospitalsClinics from '../../../assets/brand/icons/hospitals-clinics.svg';
import tabAccount from '../../../assets/brand/icons/tab-account.svg';
import tabHome from '../../../assets/brand/icons/tab-home.svg';

/**
 * Brand artwork (shared/packages/design-system/brand, provisional pending owner
 * sign-off). SVGs render through expo-image on iOS, Android and web. All are
 * decorative here: the name or label beside them carries the meaning.
 */
const ICONS = {
  'find-a-doctor': findADoctor,
  'book-appointment': bookAppointment,
  'hospitals-clinics': hospitalsClinics,
  'hmo-coverage': hmoCoverage,
  'tab-home': tabHome,
  'tab-account': tabAccount,
} as const;

export type BrandIconName = keyof typeof ICONS;

const hidden = { accessible: false, 'aria-hidden': true, accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

export function BrandMark({ size = 56 }: { size?: number }) {
  return <Image source={logoMark} style={{ width: size, height: size }} contentFit="contain" {...hidden} />;
}

/** A brand icon; pass tintColor for the single-colour tab glyphs. */
export function BrandIcon({ name, size = 40, tintColor }: { name: BrandIconName; size?: number; tintColor?: ColorValue }) {
  return <Image source={ICONS[name]} style={{ width: size, height: size }} contentFit="contain" tintColor={tintColor as string | undefined} {...hidden} />;
}
