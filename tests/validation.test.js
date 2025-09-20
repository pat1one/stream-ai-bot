const { validateNotificationTemplate, validateParameterValues } = require('../validation');

describe('Notification Template Validation', () => {
    describe('Template Validation', () => {
        it('should validate correct template', () => {
            const template = {
                name: 'test-template',
                title: 'Test notification',
                message: 'Hello ${name}!',
                parameters: [
                    {
                        name: 'name',
                        type: 'string',
                        required: true
                    }
                ],
                important: false
            };

            const result = validateNotificationTemplate(template);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject template with invalid name', () => {
            const template = {
                name: 'test template', // пробел не допускается
                title: 'Test notification',
                message: 'Hello!',
                important: false
            };

            const result = validateNotificationTemplate(template);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(expect.stringMatching(/name.*letters.*numbers/i));
        });

        it('should reject template with undefined parameters', () => {
            const template = {
                name: 'test-template',
                title: 'Test notification',
                message: 'Hello ${name}!', // параметр name не определен
                parameters: [],
                important: false
            };

            const result = validateNotificationTemplate(template);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(expect.stringMatching(/undefined parameter.*name/i));
        });

        it('should reject template with duplicate parameters', () => {
            const template = {
                name: 'test-template',
                title: 'Test notification',
                message: 'Score: ${score}',
                parameters: [
                    { name: 'score', type: 'number', required: true },
                    { name: 'score', type: 'string', required: true } // дубликат
                ],
                important: false
            };

            const result = validateNotificationTemplate(template);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(expect.stringMatching(/duplicate parameter/i));
        });

        it('should validate template with all parameter types', () => {
            const template = {
                name: 'test-template',
                title: 'Test notification',
                message: '${name} scored ${score} on ${date}, verified: ${verified}',
                parameters: [
                    { name: 'name', type: 'string', required: true },
                    { name: 'score', type: 'number', required: true },
                    { name: 'date', type: 'date', required: true },
                    { name: 'verified', type: 'boolean', required: false, default: false }
                ],
                important: true
            };

            const result = validateNotificationTemplate(template);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('Parameter Values Validation', () => {
        const template = {
            name: 'test-template',
            title: 'Test notification',
            message: '${name} scored ${score}',
            parameters: [
                { name: 'name', type: 'string', required: true },
                { name: 'score', type: 'number', required: true },
                { name: 'optional', type: 'boolean', required: false }
            ]
        };

        it('should validate correct parameter values', () => {
            const params = {
                name: 'John',
                score: 42
            };

            const result = validateParameterValues(template, params);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject missing required parameters', () => {
            const params = {
                name: 'John'
                // score отсутствует
            };

            const result = validateParameterValues(template, params);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(expect.stringMatching(/missing.*score/i));
        });

        it('should reject invalid parameter types', () => {
            const params = {
                name: 'John',
                score: '42' // должно быть числом
            };

            const result = validateParameterValues(template, params);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(expect.stringMatching(/invalid.*type.*score/i));
        });

        it('should accept optional parameters', () => {
            const params = {
                name: 'John',
                score: 42,
                optional: true // необязательный параметр
            };

            const result = validateParameterValues(template, params);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject unexpected parameters', () => {
            const params = {
                name: 'John',
                score: 42,
                unknown: 'value' // неизвестный параметр
            };

            const result = validateParameterValues(template, params);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain(expect.stringMatching(/unexpected.*unknown/i));
        });
    });
});