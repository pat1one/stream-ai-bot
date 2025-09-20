const CustomNotificationManager = require('../custom-notifications');

describe('CustomNotificationManager', () => {
    let customNotifications;
    let mockNotificationManager;

    beforeEach(() => {
        mockNotificationManager = {
            sendNotification: jest.fn()
        };
        customNotifications = new CustomNotificationManager(mockNotificationManager);
    });

    describe('validateNotificationTemplate', () => {
        it('should validate correct template', () => {
            const template = {
                name: 'test-template',
                title: 'Test Title',
                message: 'Hello ${name}!',
                parameters: [
                    { name: 'name', type: 'string', required: true }
                ],
                important: false
            };

            const result = customNotifications.validateNotificationTemplate(template);
            expect(result.valid).toBe(true);
        });

        it('should reject invalid template', () => {
            const template = {
                // Missing required fields
                name: 'test-template',
                message: 'Hello!'
            };

            const result = customNotifications.validateNotificationTemplate(template);
            expect(result.valid).toBe(false);
        });
    });

    describe('createFromTemplate', () => {
        it('should create notification with parameters', async () => {
            const templateName = 'greeting';
            const userId = 'user123';
            const parameters = { name: 'John' };

            mockNotificationManager.sendNotification.mockResolvedValue({
                id: 'notif123',
                status: 'sent'
            });

            await customNotifications.createFromTemplate(templateName, userId, parameters);

            expect(mockNotificationManager.sendNotification).toHaveBeenCalled();
        });

        it('should reject when required parameters are missing', async () => {
            const templateName = 'greeting';
            const userId = 'user123';
            const parameters = {}; // Missing required 'name' parameter

            await expect(
                customNotifications.createFromTemplate(templateName, userId, parameters)
            ).rejects.toThrow();
        });
    });

    describe('_replaceParameters', () => {
        it('should replace parameters in text', () => {
            const text = 'Hello ${name}, your score is ${score}!';
            const parameters = {
                name: 'John',
                score: 42
            };

            const result = customNotifications._replaceParameters(text, parameters);
            expect(result).toBe('Hello John, your score is 42!');
        });

        it('should leave unreplaced parameters as is', () => {
            const text = 'Hello ${name}!';
            const parameters = {}; // No parameters provided

            const result = customNotifications._replaceParameters(text, parameters);
            expect(result).toBe('Hello ${name}!');
        });
    });
});