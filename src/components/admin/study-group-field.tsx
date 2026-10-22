import * as React from "react";
import { Field, Select } from "@/components/ui/form-controls";

/** Výběr skupiny u děleného předmětu (prázdná hodnota = obě skupiny). */
export const StudyGroupField = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { id: string; what: string }>(
  function StudyGroupField({ id, what, ...props }, ref) {
    return (
      <Field label="Skupina" htmlFor={id} hint={`Předmět se učí ve skupinách. ${what} pro obě skupiny uvidí všichni.`}>
        <Select id={id} ref={ref} {...props}>
          <option value="">Obě skupiny</option>
          <option value="S1">Skupina S1</option>
          <option value="S2">Skupina S2</option>
        </Select>
      </Field>
    );
  },
);
