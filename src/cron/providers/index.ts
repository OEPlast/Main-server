import type { TrackingProvider } from './TrackingProvider';
import { GIGTrackingProvider } from './GIGTrackingProvider';

class TrackingProviderRegistry {
  private readonly providers = new Map<string, TrackingProvider>();

  register(provider: TrackingProvider): this {
    this.providers.set(provider.deliveryType, provider);
    return this;
  }

  getProvider(deliveryType: string): TrackingProvider | undefined {
    return this.providers.get(deliveryType);
  }

  get registeredTypes(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const trackingRegistry = new TrackingProviderRegistry()
  .register(GIGTrackingProvider);
  // .register(DHLTrackingProvider)  ← add future providers here
