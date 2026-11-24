import { icon, type IconName } from '@flurry/art';

/** Decorative icon (aria-hidden); pair it with visible text or an aria-label on the control. */
export function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return <span className="icon" dangerouslySetInnerHTML={{ __html: icon(name, size) }} />;
}
