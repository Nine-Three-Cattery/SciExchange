/** The UI accepts external signatures only; signing keys never enter this module. */
export interface SignaturePrompt {
  address: string;
  message: string;
  purpose: string;
  resolve: (signature: string) => void;
  reject: (error: Error) => void;
}
let present: ((request: SignaturePrompt) => void) | undefined;

export function registerSignaturePrompt(
  handler: (request: SignaturePrompt) => void,
) {
  present = handler;
  return () => {
    if (present === handler) present = undefined;
  };
}

export function signCanonical(
  address: string,
  message: string,
  purpose: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!present) {
      reject(
        new Error("Open the workspace to review and submit a PI signature."),
      );
      return;
    }
    present({ address, message, purpose, resolve, reject });
  });
}
