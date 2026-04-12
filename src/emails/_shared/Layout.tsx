/**
 * Shared email layout — wraps every Phase 10 email body in a consistent
 * header + card + footer using @react-email/components primitives.
 */
import * as React from 'react'
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
} from '@react-email/components'

interface Props {
  children: React.ReactNode
  previewText: string
}

export function EmailLayout({ children, previewText }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          fontFamily: 'sans-serif',
          backgroundColor: '#f5f5f5',
          padding: 24,
        }}
      >
        <Container
          style={{
            backgroundColor: '#fff',
            padding: 24,
            borderRadius: 8,
            maxWidth: 600,
          }}
        >
          <Section>
            <Text style={{ fontSize: 20, fontWeight: 700 }}>
              George&apos;s Predictor
            </Text>
          </Section>
          {children}
          <Section>
            <Text style={{ fontSize: 12, color: '#666', marginTop: 24 }}>
              Manage your email preferences in your profile.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
