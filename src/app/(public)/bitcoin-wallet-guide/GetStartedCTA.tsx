'use client';

import { motion } from 'framer-motion';
import { Bitcoin, Download } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { ROUTES } from '@/config/routes';

interface GetStartedCTAProps {
  onGetWallet: () => void;
}

export function GetStartedCTA({ onGetWallet }: GetStartedCTAProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="mt-16 text-center"
    >
      <Card className="max-w-2xl mx-auto bg-bitcoinOrange/10 text-bitcoinOrange border-bitcoinOrange/20 border-bitcoinOrange/30">
        <CardContent className="p-8">
          <Bitcoin className="w-16 h-16 text-bitcoinOrange mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-fg-primary mb-4">Ready to Get Started?</h2>
          <p className="text-fg-secondary mb-6">
            Once you have your Bitcoin wallet set up, you can add your Bitcoin address to your
            OrangeCat profile and start receiving funding for your projects.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={onGetWallet}
              className="bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Get a Wallet Now
            </Button>
            <Button
              href={ROUTES.PROFILES.ME}
              variant="outline"
              className="border-bitcoinOrange text-bitcoinOrange hover:bg-bitcoinOrange/10"
            >
              <Bitcoin className="w-4 h-4 mr-2" />
              Complete Profile Setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
