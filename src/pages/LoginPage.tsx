import { useState, type FormEvent } from "react";
import "../LoginPage.css";
import { login, type Account } from "../api/auth";

export function LoginPage({ onSignIn }: { onSignIn: (destination: "/" | "/pos", account: Account) => void }) {
  const [message, setMessage] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    if (!username || !password) {
      setMessage("Username and password are required.");
      return;
    }

    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const destination = submitter instanceof HTMLButtonElement && submitter.value === "/pos" ? "/pos" : "/";
    setIsSubmitting(true);
    setMessage("");
    try {
      const result = await login(username, password, destination);
      onSignIn(result.destination, result.account);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Đăng nhập thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="lg-17" id="lg-17" aria-label="Liquid glass login card">
      <div className="lg-17__mesh" aria-hidden="true" />
      <form className="lg-17__card" noValidate onSubmit={handleSubmit}>
        <h1 className="lg-17__title">Welcome back</h1>
        <p className="lg-17__sub">Cội Coffee & Beer</p>

        <div className="lg-17__field">
          <label className="lg-17__label" htmlFor="lg-17-account">tên đâng nhập</label>
          <input className="lg-17__input" id="lg-17-account" name="username" type="text" placeholder="username" autoComplete="username" />
        </div>

        <div className="lg-17__field lg-17__password-field">
          <label className="lg-17__label" htmlFor="lg-17-pass">mật khẩu</label>
          <input className="lg-17__input" id="lg-17-pass" name="password" type={passwordVisible ? "text" : "password"} placeholder="••••••••" autoComplete="current-password" />
          <button
            className="lg-17__password-toggle"
            type="button"
            aria-label={passwordVisible ? "Release to hide password" : "Hold to show password"}
            aria-pressed={passwordVisible}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              setPasswordVisible(true);
            }}
            onPointerUp={() => setPasswordVisible(false)}
            onPointerCancel={() => setPasswordVisible(false)}
            onLostPointerCapture={() => setPasswordVisible(false)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setPasswordVisible(true);
              }
            }}
            onKeyUp={(event) => {
              if (event.key === "Enter" || event.key === " ") setPasswordVisible(false);
            }}
            onBlur={() => setPasswordVisible(false)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {!passwordVisible && <path d="m3 3 18 18" />}
            </svg>
          </button>
        </div>

        <div className="lg-17__row">
          <label className="lg-17__remember"><input type="checkbox" /> Remember me</label>
          <a className="lg-17__forgot" href="#lg-17">Forgot?</a>
        </div>

        <div className="lg-17__actions">
          <button className="lg-17__submit" type="submit" name="destination" value="/" disabled={isSubmitting}>{isSubmitting ? "Đang đăng nhập…" : "Quản lý"}</button>
          <button className="lg-17__submit lg-17__submit--secondary" type="submit" name="destination" value="/pos" disabled={isSubmitting}>{isSubmitting ? "Đang đăng nhập…" : "Bán hàng"}</button>
        </div>
        
        {message && <p className="lg-17__message" role="status">{message}</p>}
        <p className="lg-17__alt">New here? <a href="#lg-17">Create an account</a></p>
      </form>
    </section>
  );
}
