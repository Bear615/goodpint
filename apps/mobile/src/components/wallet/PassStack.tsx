import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { View } from 'react-native';
import { COLLAPSED_HEIGHT, OPEN_GAP, PEEK } from './passMetrics';

export interface PassLayout {
  open: boolean;
  // Tucked under the next card, so only its header strip shows.
  covered: boolean;
  style: { marginTop: number };
}

interface PassStackProps {
  ids: string[];
  openId: string | null;
  renderPass: (id: string, layout: PassLayout) => ReactNode;
}

/**
 * Overlaps closed passes so only their header strips show, Apple Wallet style.
 * The pass after an open one sits below it instead. Later passes paint on top.
 */
export function PassStack({ ids, openId, renderPass }: PassStackProps) {
  return (
    <View>
      {ids.map((id, index) => {
        const open = id === openId;
        const marginTop = index === 0 ? 0 : ids[index - 1] === openId ? OPEN_GAP : PEEK - COLLAPSED_HEIGHT;
        return (
          <Fragment key={id}>
            {renderPass(id, { open, covered: !open && index < ids.length - 1, style: { marginTop } })}
          </Fragment>
        );
      })}
    </View>
  );
}
