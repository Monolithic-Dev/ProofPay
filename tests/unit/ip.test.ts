import { describe, it, expect } from 'vitest'
import { isPublicIp, isPrivateHostname, normalizeIpv4 } from '@/server/net/ip'

describe('PLAT-1 IP Classification and SSRF Security (ip.ts)', () => {
  describe('normalizeIpv4', () => {
    it('normalizes standard dotted quad', () => {
      expect(normalizeIpv4('127.0.0.1')).toBe('127.0.0.1')
      expect(normalizeIpv4('8.8.8.8')).toBe('8.8.8.8')
      expect(normalizeIpv4('192.168.1.50')).toBe('192.168.1.50')
    })

    it('normalizes octal representations', () => {
      expect(normalizeIpv4('0177.0.0.1')).toBe('127.0.0.1')
      expect(normalizeIpv4('012.0.0.1')).toBe('10.0.0.1')
    })

    it('normalizes hex representations', () => {
      expect(normalizeIpv4('0x7f.0.0.1')).toBe('127.0.0.1')
      expect(normalizeIpv4('0xa.0.0.1')).toBe('10.0.0.1')
    })

    it('normalizes 32-bit single integer representations', () => {
      // 2130706433 == 127.0.0.1
      expect(normalizeIpv4('2130706433')).toBe('127.0.0.1')
      // 0x7f000001 == 127.0.0.1
      expect(normalizeIpv4('0x7f000001')).toBe('127.0.0.1')
    })

    it('rejects invalid IPv4 formats', () => {
      expect(normalizeIpv4('256.0.0.1')).toBeNull()
      expect(normalizeIpv4('1.2.3.4.5')).toBeNull()
      expect(normalizeIpv4('invalid')).toBeNull()
    })
  })

  describe('isPublicIp table-driven tests (>= 40 cases)', () => {
    const testCases: Array<{ ip: string; expectedPublic: boolean; reason: string }> = [
      // Loopback
      { ip: '127.0.0.1', expectedPublic: false, reason: 'IPv4 loopback' },
      { ip: '127.0.0.2', expectedPublic: false, reason: 'IPv4 loopback subnet' },
      { ip: '127.255.255.254', expectedPublic: false, reason: 'IPv4 loopback edge' },
      { ip: '0177.0.0.1', expectedPublic: false, reason: 'Octal loopback' },
      { ip: '0x7f.0.0.1', expectedPublic: false, reason: 'Hex loopback' },
      { ip: '2130706433', expectedPublic: false, reason: 'Integer loopback' },
      { ip: '::1', expectedPublic: false, reason: 'IPv6 loopback' },
      { ip: '[::1]', expectedPublic: false, reason: 'Bracketed IPv6 loopback' },
      { ip: '::ffff:127.0.0.1', expectedPublic: false, reason: 'IPv4-mapped IPv6 loopback' },

      // "This host on this network"
      { ip: '0.0.0.0', expectedPublic: false, reason: 'Zero address' },
      { ip: '0.1.2.3', expectedPublic: false, reason: '0/8 network' },
      { ip: '::', expectedPublic: false, reason: 'IPv6 unspecified' },

      // RFC 1918 Private 10/8
      { ip: '10.0.0.1', expectedPublic: false, reason: '10/8 network' },
      { ip: '10.255.255.255', expectedPublic: false, reason: '10/8 broadcast' },
      { ip: '::ffff:10.0.0.1', expectedPublic: false, reason: 'IPv4-mapped 10/8' },

      // RFC 1918 Private 172.16/12
      { ip: '172.16.0.1', expectedPublic: false, reason: '172.16/12 network' },
      { ip: '172.20.10.5', expectedPublic: false, reason: '172.16/12 internal' },
      { ip: '172.31.255.255', expectedPublic: false, reason: '172.16/12 top edge' },

      // RFC 1918 Private 192.168/16
      { ip: '192.168.0.1', expectedPublic: false, reason: '192.168/16 network' },
      { ip: '192.168.1.254', expectedPublic: false, reason: '192.168/16 host' },

      // Shared Address Space / CGNAT 100.64/10
      { ip: '100.64.0.1', expectedPublic: false, reason: 'CGNAT start' },
      { ip: '100.127.255.254', expectedPublic: false, reason: 'CGNAT end' },

      // Link-Local / Cloud Metadata 169.254/16
      { ip: '169.254.169.254', expectedPublic: false, reason: 'AWS/GCP/Azure Cloud Metadata' },
      { ip: '169.254.1.1', expectedPublic: false, reason: 'Link local IPv4' },
      { ip: 'fe80::1', expectedPublic: false, reason: 'Link local IPv6' },
      { ip: 'fe80::dead:beef', expectedPublic: false, reason: 'Link local IPv6 host' },

      // Documentation (TEST-NET 1, 2, 3)
      { ip: '192.0.2.1', expectedPublic: false, reason: 'TEST-NET-1' },
      { ip: '198.51.100.1', expectedPublic: false, reason: 'TEST-NET-2' },
      { ip: '203.0.113.1', expectedPublic: false, reason: 'TEST-NET-3' },

      // Benchmarking & Protocol assignments
      { ip: '192.0.0.1', expectedPublic: false, reason: 'IETF protocol' },
      { ip: '198.18.0.1', expectedPublic: false, reason: 'Benchmarking 198.18/15' },

      // Multicast & Reserved
      { ip: '224.0.0.1', expectedPublic: false, reason: 'Multicast 224/4' },
      { ip: '239.255.255.250', expectedPublic: false, reason: 'SSDP multicast' },
      { ip: '240.0.0.1', expectedPublic: false, reason: 'Reserved 240/4' },
      { ip: 'ff02::1', expectedPublic: false, reason: 'IPv6 Multicast' },

      // IPv6 Unique Local Address (ULA) fc00::/7
      { ip: 'fc00::1', expectedPublic: false, reason: 'IPv6 ULA start' },
      { ip: 'fd12:3456:789a::1', expectedPublic: false, reason: 'IPv6 ULA random' },

      // Public routable IPs (MUST return true)
      { ip: '8.8.8.8', expectedPublic: true, reason: 'Google Public DNS' },
      { ip: '1.1.1.1', expectedPublic: true, reason: 'Cloudflare Public DNS' },
      { ip: '93.184.216.34', expectedPublic: true, reason: 'example.com' },
      { ip: '140.82.112.4', expectedPublic: true, reason: 'GitHub IPv4' },
      { ip: '2606:4700:4700::1111', expectedPublic: true, reason: 'Cloudflare Public IPv6' },
      { ip: '2001:4860:4860::8888', expectedPublic: true, reason: 'Google Public IPv6' },
      { ip: '172.15.254.1', expectedPublic: true, reason: 'Below 172.16/12 range' },
      { ip: '172.32.0.1', expectedPublic: true, reason: 'Above 172.16/12 range' },
      { ip: '100.63.255.255', expectedPublic: true, reason: 'Below CGNAT range' },
      { ip: '100.128.0.1', expectedPublic: true, reason: 'Above CGNAT range' },
    ]

    for (const { ip, expectedPublic, reason } of testCases) {
      it(`correctly classifies "${ip}" as ${expectedPublic ? 'PUBLIC' : 'BLOCKED'} (${reason})`, () => {
        expect(isPublicIp(ip)).toBe(expectedPublic)
      })
    }
  })

  describe('isPrivateHostname', () => {
    it('identifies internal and reserved domain suffixes', () => {
      expect(isPrivateHostname('localhost')).toBe(true)
      expect(isPrivateHostname('foo.localhost')).toBe(true)
      expect(isPrivateHostname('api.internal')).toBe(true)
      expect(isPrivateHostname('service.local')).toBe(true)
      expect(isPrivateHostname('router.lan')).toBe(true)
      expect(isPrivateHostname('server.corp')).toBe(true)
      expect(isPrivateHostname('example.com')).toBe(false)
      expect(isPrivateHostname('api.paypal.com')).toBe(false)
    })
  })
})

