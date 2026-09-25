'use client';

import { motion } from 'framer-motion';
import { Bitcoin, CheckCircle, AlertTriangle, Download, ExternalLink, Shield } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import type { WalletOption } from './config';

interface WalletDetailProps {
  wallet: WalletOption;
}

export function WalletDetail({ wallet }: WalletDetailProps) {
  return (
    <motion.div
      key={wallet.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="sticky top-20"
    >
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bitcoin className="w-5 h-5 text-bitcoinOrange" />
            {wallet.name}
          </CardTitle>
          <CardDescription>Detailed information and setup guide</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div>
            <h4 className="font-semibold text-status-positive mb-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Advantages
            </h4>
            <ul className="space-y-1 text-sm">
              {wallet.pros.map((pro, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-status-positive rounded-full mt-2 flex-shrink-0" />
                  {pro}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-status-warning mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Considerations
            </h4>
            <ul className="space-y-1 text-sm">
              {wallet.cons.map((con, index) => (
                <li key={index} className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-status-warning rounded-full mt-2 flex-shrink-0" />
                  {con}
                </li>
              ))}
            </ul>
          </div>

          <Button
            onClick={() => window.open(wallet.downloadUrl, '_blank')}
            className="w-full bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Get {wallet.name}
            <ExternalLink className="w-4 h-4 ml-2" />
          </Button>

          <div className="oc-error-surface rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-status-negative mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <strong className="text-status-negative">Security Tip:</strong>
                <p className="text-status-negative/80 mt-1">
                  Always download wallets from official websites. Save your recovery phrase in a
                  safe place - it&apos;s the only way to recover your Bitcoin if you lose access to
                  your wallet.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
