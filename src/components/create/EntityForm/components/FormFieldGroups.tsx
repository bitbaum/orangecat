'use client';

import { FormField } from '../../FormField';
import { AIGeneratedIndicator } from './AIGeneratedIndicator';
import type { FieldConfig, FieldGroup, FormState, AIGeneratedFields } from '../../types';

interface FormFieldGroupsProps<T extends Record<string, unknown>> {
  visibleFieldGroups: FieldGroup[];
  isGroupVisible: (group: FieldGroup) => boolean;
  isFieldVisible: (field: FieldConfig) => boolean;
  formState: FormState<T>;
  handleFieldChange: (name: keyof T, value: unknown) => void;
  handleFieldFocus: (name: string) => void;
  handleFieldBlur: (name: string) => void;
  aiGeneratedFields: AIGeneratedFields;
}

export function FormFieldGroups<T extends Record<string, unknown>>({
  visibleFieldGroups,
  isGroupVisible,
  isFieldVisible,
  formState,
  handleFieldChange,
  handleFieldFocus,
  handleFieldBlur,
  aiGeneratedFields,
}: FormFieldGroupsProps<T>) {
  return (
    <>
      {visibleFieldGroups.map(group => {
        if (!isGroupVisible(group)) {
          return null;
        }

        if (group.customComponent) {
          const CustomComponent = group.customComponent;
          return (
            <div key={group.id} className="space-y-4">
              <CustomComponent
                formData={formState.data as Record<string, unknown>}
                onFieldChange={(field, value) => handleFieldChange(field as keyof T, value)}
                disabled={formState.isSubmitting}
              />
            </div>
          );
        }

        return (
          <div key={group.id} className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-fg-primary">{group.title}</h3>
              {group.description && (
                <p className="text-base text-fg-secondary mt-1">{group.description}</p>
              )}
            </div>

            {group.fields && group.fields.length > 0 && (
              // Single-column, full-width fields. A 2-up grid halved every input
              // (~half width on desktop), which cramped long titles/text and
              // couldn't be widened. Single-column forms are the best-practice
              // default — faster to complete and readable at any text length.
              <div className="space-y-4">
                {group.fields.map(field => {
                  if (!isFieldVisible(field)) {
                    return null;
                  }

                  const isAIGenerated = aiGeneratedFields.fields.has(field.name);
                  const aiConfidence = aiGeneratedFields.confidence[field.name] || 0.7;

                  return (
                    <div key={field.name} className={isAIGenerated ? 'relative' : ''}>
                      {isAIGenerated && <AIGeneratedIndicator confidence={aiConfidence} />}
                      <div
                        className={
                          isAIGenerated ? 'ring-1 ring-border-strong rounded-md p-0.5' : ''
                        }
                      >
                        <FormField
                          config={field}
                          value={formState.data[field.name as keyof T]}
                          error={formState.errors[field.name]}
                          onChange={value => handleFieldChange(field.name as keyof T, value)}
                          onFocus={() => handleFieldFocus(field.name)}
                          onBlur={() => handleFieldBlur(field.name)}
                          disabled={formState.isSubmitting}
                          subject={{
                            title: String(formState.data['title' as keyof T] ?? ''),
                            description: String(formState.data['description' as keyof T] ?? ''),
                          }}
                          currency={
                            'currency' in formState.data
                              ? (formState.data.currency as string)
                              : undefined
                          }
                          onCurrencyChange={
                            field.type === 'currency' && 'currency' in formState.data
                              ? currency => handleFieldChange('currency' as keyof T, currency)
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
