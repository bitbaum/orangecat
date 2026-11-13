'use client';

import { motion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { setupSteps } from './config';

interface ProgressStepsProps {
  currentStep: number;
  onStepClick: (index: number) => void;
}

export function ProgressSteps({ currentStep, onStepClick }: ProgressStepsProps) {
  return (
    <div className="mb-12">
      <h2 className="text-2xl font-semibold text-fg-primary mb-6 text-center">
        How to Get Started
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {setupSteps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`text-center p-6 rounded-lg border-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-interactive bg-surface-raised text-fg-primary'
                  : isCompleted
                    ? 'bg-status-positive-subtle border-status-positive/20 text-status-positive'
                    : 'bg-surface-base border-default hover:border-strong dark:hover:border-default'
              }`}
              onClick={() => onStepClick(index)}
            >
              <div
                className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  isActive
                    ? 'bg-bitcoinOrange text-on-accent'
                    : isCompleted
                      ? 'bg-status-positive text-fg-inverted'
                      : 'bg-surface-raised text-fg-secondary'
                }`}
              >
                {isCompleted ? <CheckCircle className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
              </div>
              <h3 className="font-semibold mb-2">{step.title}</h3>
              <p className="text-sm text-fg-secondary">{step.description}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
