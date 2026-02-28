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
import { useTranslation } from 'react-i18next';

interface OnboardingFlowProps {
  /** Called when the user dismisses the onboarding tutorial. */
  onComplete: () => void;
}

const STEP_KEYS = [
  { titleKey: 'onboarding.step1Title', descKey: 'onboarding.step1Desc' },
  { titleKey: 'onboarding.step2Title', descKey: 'onboarding.step2Desc' },
  { titleKey: 'onboarding.step3Title', descKey: 'onboarding.step3Desc' },
] as const;

/**
 * First-time user onboarding tutorial.
 *
 * A 3-step inline Stepper that explains the basic extraction workflow.
 * Completion is persisted to `chrome.storage.local` by the parent
 * component.
 */
function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);

  const handleNext = () => {
    if (activeStep < STEP_KEYS.length - 1) {
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
        {t('onboarding.welcome')}
      </Typography>

      <Stepper activeStep={activeStep} orientation="vertical">
        {STEP_KEYS.map((step, index) => (
          <Step key={step.titleKey}>
            <StepLabel>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {t(step.titleKey)}
              </Typography>
            </StepLabel>
            <StepContent>
              <Typography variant="caption" color="text.secondary">
                {t(step.descKey)}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Button
                  variant={index === STEP_KEYS.length - 1 ? 'contained' : 'text'}
                  size="small"
                  onClick={handleNext}
                >
                  {index === STEP_KEYS.length - 1 ? t('onboarding.gotIt') : t('onboarding.next')}
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
