export interface AddressClaims {
  /**
   * Full mailing address, formatted for display or use on a mailing label. This field MAY contain multiple lines, separated by newlines. Newlines can be represented either as a carriage return/line feed pair ("\r\n") or as a single line feed character ("\n").
   */
  formatted: string;

  /**
   * Full street address component, which MAY include house number, street name, Post Office Box, and multi-line extended street address information. This field MAY contain multiple lines, separated by newlines. Newlines can be represented either as a carriage return/line feed pair ("\r\n") or as a single line feed character ("\n").
   */
  street_address: string;

  /**
   * City or locality component.
   */
  locality: string;

  /**
   * State, province, prefecture, or region component.
   */
  region: string;

  /**
   * Zip code or postal code component.
   */
  postal_code: string;

  /**
   * Country name component.
   */
  country: string;
}
