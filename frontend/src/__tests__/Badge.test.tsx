import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders children text", () => {
    render(<Badge>Python</Badge>);
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("Python")).toHaveClass("bg-gray-100", "text-gray-800");
  });

  it("applies variant styles", () => {
    render(<Badge variant="success">Match</Badge>);
    expect(screen.getByText("Match")).toHaveClass("bg-green-100", "text-green-800");
  });

  it("applies custom className", () => {
    render(<Badge className="extra-class">Badge</Badge>);
    expect(screen.getByText("Badge")).toHaveClass("extra-class");
  });
});
