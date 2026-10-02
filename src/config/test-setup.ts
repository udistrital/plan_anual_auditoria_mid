import { jest } from '@jest/globals';

global.jest = jest;

jest.unstable_mockModule('nestjs-pino', () => {
	class MockPinoLogger {}
	class MockLoggerModule {}

	return {
		InjectPinoLogger: () => () => undefined,
		PinoLogger: MockPinoLogger,
		LoggerModule: {
			forRoot: () => ({
				module: MockLoggerModule,
				global: true,
				providers: [MockPinoLogger],
				exports: [MockPinoLogger],
			}),
		},
	};
});
