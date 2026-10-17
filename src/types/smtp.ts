// What the browser is allowed to know about saved SMTP settings. Never the password.
export type SmtpPublic = {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  senderName: string;
};