<script setup lang="ts">
import GameTitle from './SteamGameTitle.vue';
import { computed, ref, onMounted } from 'vue'

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

// 分页相关状态
const currentPage = ref(1);
const itemsPerPage = 3;

// 计算属性
const totalPages = computed(() => {
  if (!gamesData.value?.allGames) return 1;
  return Math.ceil(gamesData.value.allGames.length / itemsPerPage);
});

// 成就完成度颜色
const getAchievementColor = (percentage: number) => {
  if (percentage === 100) return '#10b981'; // 绿色 - 完成
  if (percentage >= 50) return '#3b82f6'; // 蓝色 - 进行中
  return '#6b7280'; // 灰色 - 刚开始
};

// 成就图标颜色
const getAchievementIconColor = (unlocked: number, total: number) => {
  return unlocked === total ? '#10b981' : '#6b7280';
};

// 初始加载数据
onMounted(async () => {
  try {
    // 获取基础数据
    await fetchSteamData();
    
    // 如果用户正在游戏中,获取游戏详情
    if (userData.value?.currentGame) {
      await fetchGameDetail(userData.value.currentGame.appid);
    }
  } catch (error) {
    console.error('加载 Steam 数据失败:', error);
  }
});

// 处理页面变化
const handlePageChange = (page: number) => {
  currentPage.value = page;
  // 可选: 滚动到顶部
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
</script>

<template>
  <div class="SteamGameMain">
    <GameTitle title="游戏库" icon="stack-bold" :sub-title="`显示游玩时长最多的${gamesData?.totalCount}款游戏`"/>
    <div class="SteamGameList">
      <a class="GameListCard" v-show="game.name !== 'Maiden And Lord'" v-for="game in gamesData?.allGames" :href="`https://steamcommunity.com/app/${game.appid}`" target="_blank">
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
          <div class="ListCardAchievements"  v-if="game.achievements">
            <div class="CardAchievementsInfo">
              <div class="AchievementsInfoLabel">
                <Icon class="InfoLabelIcon" name="i-ph:trophy-bold" :style="`color: ${game.achievements?.percentage === game.achievements?.total}`"/>
                <span class="InfoLabelCount">
                  {{ game.achievements?.unlocked }} / {{ game.achievements?.total }}
                </span>
              </div>
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
</template>

<style lang="scss" scoped>
.SteamGameMain{
  .SteamGameList {
    display: grid;
    gap: 5px;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    @media (max-width: 767px) {
      gap: .4em;
      padding-bottom: .4em;
    }
    .GameListCard {
      background: var(--ld-bg-card);
      border: 1px solid var(--c-border);
      border-radius: 12px;
      cursor: pointer;
      overflow: hidden;
      position: relative;
      transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
      width: 100%;
      flex-direction: column;
      height: auto;
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