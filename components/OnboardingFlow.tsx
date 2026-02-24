import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';

interface OnboardingFlowProps {
  /** Called when the user dismisses the onboarding tutorial. */
  onComplete: () => void;
}

/** Onboarding step definitions. */
const STEPS = [
  {
    label: 'Browse a product page',
    description: 'Navigate to any product page on the web (e.g., Amazon, Wayfair, or any online store).',
  },
  {
    label: 'Click Extract to analyze',
    description: 'Click the "Extract Product Data" button and our AI will identify the product name, price, manufacturer, and more.',
  },
  {
    label: 'Choose a document and add',
    description: 'Select one of your estimate documents and a tab, then click "Add to Estimate" to save the product.',
  },
];

/**
 * First-time user onboarding tutorial.
 *
 * A 3-step inline Stepper that explains the basic extraction workflow.
 * Completion is persisted to `chrome.storage.local` by the parent
 * component.
 */
function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 1,
        p: 2,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
        Welcome to Rerum Estimator
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        {STEPS.map((step, index) => (
          <Step key={step.label}>
            <StepLabel>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {step.label}
              </Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="caption" color="text.secondary">
                {step.description}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Button
                  variant={index === STEPS.length - 1 ? 'contained' : 'text'}
                  size="small"
                  onClick={handleNext}
                >
                  {index === STEPS.length - 1 ? 'Got it!' : 'Next'}
                </Button>
              </Box>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}

export default OnboardingFlow;
