type VarModel = {
  get: (name: string) => unknown;
  value: (...args: unknown[]) => unknown;
  changeValue: (value: unknown, action?: unknown) => unknown;
};

type VarProto = VarModel & {
  __swCountDownPatched?: boolean;
};

type StorylineWin = Window & {
  __swStorylineCountDown?: boolean;
  DS?: {
    resolver?: {
      getPresentationContext?: () => {
        variables?: () => { models: VarModel[] };
      };
    };
  };
};

export function runStorylineTimerNextBypass(): void {
  const w = window as StorylineWin;
  if (w.__swStorylineCountDown) return;
  w.__swStorylineCountDown = true;

  const boot = (): void => {
    const model = w.DS?.resolver?.getPresentationContext?.()?.variables?.().models.find((m) => m.get('name') === 'CountDown');
    if (!model) {
      window.setTimeout(boot, 50);
      return;
    }

    const proto = Object.getPrototypeOf(model) as VarProto;
    if (proto.__swCountDownPatched) return;
    proto.__swCountDownPatched = true;

    const changeValue = proto.changeValue;
    proto.changeValue = function (this: VarModel, value: unknown, action?: unknown) {
      if (this.get('name') !== 'CountDown') return changeValue.call(this, value, action);
      if (Number(value) > 0 && Number(this.value()) === 0) {
        changeValue.call(this, 1, action);
        return changeValue.call(this, 0, action);
      }
      return changeValue.call(this, 0, action);
    };

    if (Number(model.value()) !== 0) model.changeValue(0);
  };

  boot();
}
