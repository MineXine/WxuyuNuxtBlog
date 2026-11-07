<script setup lang="ts">
import appConfig from '~/app.config';
import GameTitle from './SteamGameTitle.vue';
import Autoplay from 'embla-carousel-autoplay'
import emblaCarouselVue from 'embla-carousel-vue'
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures'

const { 
  fetchSteamData, 
  fetchGameDetail,
  formatPlaytime, 
  formatSteamTime,
  userData, 
  gamesData, 
  achievementsData,
  statusTextMap, 
  statusColorMap 
} = useSteamAPIGet()

// 初始加载数据
onMounted(async () => {
  // 获取基础数据
  await fetchSteamData()
  
  // 如果用户正在游戏中，获取游戏详情
  if (userData.value?.currentGame) {
    await fetchGameDetail(userData.value.currentGame.appid)
  }
})

const textAPI = gamesData.value?.recentGames


// 滚动支持
const compConf = computed(() => appConfig.component.slide)
// @keep-sorted
const [carouselEl, carouselApi] = emblaCarouselVue({
	containScroll: false,
	loop: true,
	skipSnaps: true,
}, [
	Autoplay({ stopOnInteraction: false, stopOnMouseEnter: true }),
	WheelGesturesPlugin(),
])

// 鼠标横向滚动 / Shift + 纵向滚轮事件
useEventListener(carouselEl, 'wheel', (e) => {
	const delta = e.deltaX + (e.shiftKey ? e.deltaY : 0)
	if (Math.abs(delta) < 80)
		return
	delta > 0 ? carouselApi.value?.scrollNext() : carouselApi.value?.scrollPrev()
}, { passive: true })
</script>

<template>
  <div class="SteamGameMain">
    <GameTitle title="最近游玩" icon="game-controller-bold" :sub-title="`显示最近两周玩的${gamesData?.recentCount}款游戏`" sub-tip="请按Shift + 滚动或滑动"/>
    <div ref="carouselEl" class="SteamGameBody" dir="ltr">
      <div class="SteamGameList">
        <a class="GameListCard" v-show="game.name !== '少女与城主'" v-for="game in gamesData?.recentGames" :href="`https://steamcommunity.com/app/${game.appid}`" target="_blank">
          <div class="ListCardHeader">
            <NuxtImg v-if="game.images?.headerImage" class="CardHeaderImage" :src="game.images.headerImage" />
          </div>
          <div class="ListCardBody">
            <div class="CardBodyInfo">
              <h3 class="BodyInfoTitle">{{ game.name }}</h3>
              <div class="BodyInfoStatus">
                <div class="InfoStatusRow">
                  <div class="StatusRowText">
                    <div class="RowTextLabel">
                      总时长
                    </div>
                    <div class="RowTextValue">
                      {{ game.playtimeForever }}h
                    </div>
                  </div>
                  <Badge class="StatusRowBadge" :text="`最近${ game.playtimeTwoWeeks }h`" />
                </div>
              </div>
            </div>
            <div class="ListCardAchievements" v-if="game.achievements">
              <div class="CardAchievementsInfo">
                <div class="AchievementsInfoLabel">
                  <Icon class="InfoLabelIcon" name="i-ph:trophy-bold" :style="`color: ${game.achievements?.percentage === game.achievements?.total}`"/>
                  <span class="InfoLabelCount">
                    {{ game.achievements?.unlocked }} / {{ game.achievements?.total }}
                  </span>
                </div>
                <span class="GamePriceNumber">{{ game.price.displayPrice }}</span>
              </div>
              <div class="CardAchievementsProgress">
                <div class="AchievementsProgressContainer" style="height: 6px;">
                  <div class="ProgressCcontainerBar" :style="`width: ${game.achievements?.percentage}%`" />
                </div>
              </div>
            </div>
          </div>
        </a>        
      </div>
    </div>
    <!-- <ZButton
			class="carousel-action prev at-slide-hover"
			aria-label="上一页"
			icon="ph:caret-left-bold"
			@click="carouselApi?.scrollPrev()"
		/>

		<ZButton
			class="carousel-action next at-slide-hover"
			aria-label="下一页"
			icon="ph:caret-right-bold"
			@click="carouselApi?.scrollNext()"
		/> -->
  </div>
</template>

<style lang="scss" scoped>
.SteamGameMain{
  .SteamGameBody {
    --fadeout-width: 1.5rem;
    cursor: grab;
    -webkit-mask-image: linear-gradient(to var(--end), transparent, #fff var(--fadeout-width), #fff calc(100% - var(--fadeout-width)), transparent);
    mask-image: linear-gradient(to var(--end), transparent, #fff var(--fadeout-width), #fff calc(100% - var(--fadeout-width)), transparent);
    overflow: hidden;
    position: relative;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
  }
  .SteamGameList {
		display: flex;
		scroll-snap-type: x mandatory;
    @media (max-width: 767px) {
      gap: .4em;
      padding-bottom: .4em;
    }
    .GameListCard {
      background: var(--ld-bg-card);
      border: 1px solid var(--c-border);
      border-radius: 12px;
      aspect-ratio: 1.77;
      contain: paint;
      flex-shrink: 0;
      margin: 0 min(.5em, 1%);
      max-width: 100%;
      position: relative;
      scroll-snap-align: center;
      scroll-snap-stop: always;
      width: max(12rem, 35%);
      @media (max-width: 640px) {
        width: max(15rem, 65%)
      }
      .ListCardHeader {
        flex-shrink: 0;
        min-width: 140px;
        overflow: hidden;
        position: relative;
        height: 160px;
        max-width: none;
        width: 100%;
        .CardHeaderImage {
          height: 100%;
          -o-object-fit: cover;
          object-fit: cover;
          transition: transform .4s ease;
          width: 100%;
        }
      }
      .ListCardBody {
        flex: 1;
        justify-content: space-between;
        min-width: 0;
        padding: 12px 16px;
        display: flex;
        flex-direction: column;
        @media (max-width: 640px) {
          gap: 16px;
          padding: 12px;
        }
        .CardBodyInfo {
          display: flex;
          flex-direction: column;
          gap: 6px;
          .BodyInfoTitle {
            color: var(--c-text);
            display: -webkit-box;
            font-size: 1rem;
            font-weight: 700;
            -webkit-line-clamp: 1;
            line-clamp: 1;
            line-height: 1.3;
            margin: 0;
            overflow: hidden;
            -webkit-box-orient: vertical;
          }
          .BodyInfoStatus {
            color: var(--c-text-2);
            flex-wrap: wrap;
            font-size: .85rem;
            gap: 12px;
            .InfoStatusRow {
              align-items: center;
              display: flex;
              gap: 6px;
              .StatusRowText {
                align-items: baseline;
                display: flex;
                gap: 4px;
                .RowTextLabel {
                  color: var(--c-text-2);
                  font-size: .9em;
                  font-weight: 600;
                  margin-bottom: .2em;
                  font-synthesis: weight style;
                }
                .RowTextValue {
                  color: var(--c-text-1);
                  font-family: var(--font-monospace, monospace);
                  font-weight: 600;
                  font-size: 1.5em;
                }
              }
              .StatusRowBadge:not([href]) {
                background-color: var(--c-primary-soft, color-mix(in srgb, var(--c-primary) 10%, transparent));
                border-color: var(--c-primary-light, color-mix(in srgb, var(--c-primary) 30%, transparent));
                color: var(--c-primary);
              }
            }
          }
        }
        .ListCardAchievements {
          margin-top: auto;
          .CardAchievementsInfo {
            align-items: center;
            display: flex;
            font-size: .8rem;
            justify-content: space-between;
            margin-bottom: 6px;
            .AchievementsInfoLabel {
              align-items: center;
              color: var(--c-text-2);
              display: flex;
              gap: 6px;
            }
          }
          .CardAchievementsProgress {
            align-items: center;
            display: flex;
            gap: .5rem;
            width: 100%;
            .AchievementsProgressContainer {
              background: var(--c-bg-2);
              border-radius: 2px;
              cursor: pointer;
              flex: 1;
              min-width: 0;
              overflow: visible;
              position: relative;
              transition: background-color .15s ease;
              -webkit-user-select: none;
              -moz-user-select: none;
              user-select: none;
              .ProgressCcontainerBar {
                background: var(--c-primary);
                border-radius: 2px;
                height: 100%;
                position: relative;
                transition: width .1s linear;
              } 
            }
          }
        }
      }
    }
  }
}
.InfoLabelIcon {
    color: #10b981;
}
</style>