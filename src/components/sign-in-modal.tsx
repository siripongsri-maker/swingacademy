import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

// Thin shim: the old modal is replaced by the /auth page with role tabs.
// Kept as a component so existing call sites keep working.
export function SignInModal({
  open,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn?: () => void;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    if (open) {
      onClose();
      void onSignedIn;
      navigate({ to: "/auth" });
    }
  }, [open, onClose, navigate, onSignedIn]);
  return null;
}
