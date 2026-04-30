import type { Module, ModuleContext } from '@/lib/core/types';
import { APP_VERSION } from '@/lib/core/version';

export default class ExampleModule implements Module {
  id = 'example';
  name = '示例模块';
  version = APP_VERSION;
  description = '用于验证模块化内核是否正常工作';

  lifecycle = {
    install: async (context: ModuleContext): Promise<void> => {
      context.logger.info('Example module installing...');
    },
    enable: async (context: ModuleContext): Promise<void> => {
      context.logger.info('Example module enabling...');

      // Register a simple service
      context.container.register('ExampleService', () => ({
        greet: (name: string) => `Hello, ${name}! From ExampleModule.`,
      }));

      // Subscribe to events
      context.eventBus.on('example.ping', (event) => {
        context.logger.info(`Received ping: ${JSON.stringify(event.payload)}`);
        context.eventBus.emit({
          type: 'example.pong',
          payload: { original: event.payload, timestamp: new Date() },
          timestamp: new Date(),
          source: 'example',
        });
      });

      context.logger.info('Example module enabled with service and event handler');
    },
    disable: async (): Promise<void> => {
      console.log('[ExampleModule] Disabled');
    },
    uninstall: async (): Promise<void> => {
      console.log('[ExampleModule] Uninstalled');
    },
  };
}
