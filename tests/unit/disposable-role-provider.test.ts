import { describe, it, expect } from "vitest";
import { DisposableDomainService } from "@/server/verification/disposable/disposable-service";
import { RoleAddressService } from "@/server/verification/role/role-service";
import { ProviderDetector } from "@/server/verification/provider/provider-detector";
import { FreeProviderService } from "@/server/verification/provider/free-providers";

describe("Disposable, Role, and Provider Services", () => {
  describe("DisposableDomainService", () => {
    it("should identify known disposable email domains", () => {
      expect(DisposableDomainService.isDisposable("mailinator.com")).toBe(true);
      expect(DisposableDomainService.isDisposable("10minutemail.com")).toBe(true);
      expect(DisposableDomainService.isDisposable("guerrillamail.com")).toBe(true);
      expect(DisposableDomainService.isDisposable("tempmail.com")).toBe(true);
    });

    it("should not flag legitimate domains as disposable", () => {
      expect(DisposableDomainService.isDisposable("gmail.com")).toBe(false);
      expect(DisposableDomainService.isDisposable("microsoft.com")).toBe(false);
      expect(DisposableDomainService.isDisposable("acme.corp")).toBe(false);
    });
  });

  describe("RoleAddressService", () => {
    it("should identify common operational role prefixes", () => {
      expect(RoleAddressService.isRoleAddress("support")).toBe(true);
      expect(RoleAddressService.isRoleAddress("sales")).toBe(true);
      expect(RoleAddressService.isRoleAddress("admin")).toBe(true);
      expect(RoleAddressService.isRoleAddress("billing")).toBe(true);
      expect(RoleAddressService.isRoleAddress("help")).toBe(true);
      expect(RoleAddressService.isRoleAddress("jobs")).toBe(true);
      expect(RoleAddressService.isRoleAddress("contact")).toBe(true);
      expect(RoleAddressService.isRoleAddress("marketing")).toBe(true);
    });

    it("should not identify personal names as roles", () => {
      expect(RoleAddressService.isRoleAddress("john")).toBe(false);
      expect(RoleAddressService.isRoleAddress("sarah.connor")).toBe(false);
      expect(RoleAddressService.isRoleAddress("alexander")).toBe(false);
    });
  });

  describe("ProviderDetector", () => {
    it("should detect Google Workspace from MX records", () => {
      const mxRecords = [
        { exchange: "aspmx.l.google.com", priority: 1 },
        { exchange: "alt1.aspmx.l.google.com", priority: 5 },
      ];
      expect(ProviderDetector.detect(mxRecords)).toBe("Google Workspace");
    });

    it("should detect Microsoft 365 from MX records", () => {
      const mxRecords = [{ exchange: "company-com.mail.protection.outlook.com", priority: 0 }];
      expect(ProviderDetector.detect(mxRecords)).toBe("Microsoft 365");
    });

    it("should detect Cloudflare Email Routing", () => {
      const mxRecords = [{ exchange: "isaac.mx.cloudflare.net", priority: 10 }];
      expect(ProviderDetector.detect(mxRecords)).toBe("Cloudflare Email Routing");
    });

    it("should return Unknown for unclassified MX", () => {
      const mxRecords = [{ exchange: "mail.randomcustomhost.org", priority: 10 }];
      expect(ProviderDetector.detect(mxRecords)).toBe("Unknown");
    });
  });

  describe("FreeProviderService", () => {
    it("should identify free public mailbox providers", () => {
      expect(FreeProviderService.isFreeProvider("gmail.com")).toBe(true);
      expect(FreeProviderService.isFreeProvider("yahoo.com")).toBe(true);
      expect(FreeProviderService.isFreeProvider("outlook.com")).toBe(true);
      expect(FreeProviderService.isFreeProvider("hotmail.com")).toBe(true);
      expect(FreeProviderService.isFreeProvider("proton.me")).toBe(true);
      expect(FreeProviderService.isFreeProvider("icloud.com")).toBe(true);
    });

    it("should not flag corporate / custom domains as free providers", () => {
      expect(FreeProviderService.isFreeProvider("apple.com")).toBe(false);
      expect(FreeProviderService.isFreeProvider("stripe.com")).toBe(false);
      expect(FreeProviderService.isFreeProvider("mycompany.io")).toBe(false);
    });
  });
});
